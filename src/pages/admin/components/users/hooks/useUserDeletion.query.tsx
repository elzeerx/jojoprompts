import React, { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { DeleteUserDialog } from "@/components/admin/DeleteUserDialog";
import { Button } from "@/components/ui/button";

interface UserDeletionResult {
  success: boolean;
  message?: string;
  data?: any;
  code?: string;
  isRetryable?: boolean;
}

interface DeletionError {
  code?: string;
  message: string;
  isRetryable?: boolean;
  httpStatus?: number;
}

/**
 * Categorize deletion errors from backend
 */
function categorizeDeletionError(error: any): DeletionError {
  const errorData = error?.message ? JSON.parse(error.message || '{}') : {};
  const code = errorData.code || error.code;
  const message = errorData.error || error.message || 'Unknown error occurred';
  const isRetryable = errorData.isRetryable ?? true;
  const httpStatus = errorData.status || 500;

  return {
    code,
    message,
    isRetryable,
    httpStatus
  };
}

export function useUserDeletion() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lastError, setLastError] = useState<DeletionError | null>(null);
  const [userToDelete, setUserToDelete] = useState<{
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
  } | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async ({ userId, email }: { userId: string; email: string }): Promise<UserDeletionResult> => {
      console.log(`[UserDeletion] Attempting to delete user ${userId} (${email})`);
      
      try {
        // Primary method: Use Edge Function
        const { data, error } = await supabase.functions.invoke('get-all-users', {
          body: {
            action: 'delete',
            userId,
            ip_address: window.location.hostname,
            user_agent: navigator.userAgent
          }
        });
        
        if (error) {
          console.error("[UserDeletion] Edge Function error:", error);
          throw new Error(error?.message || 'Edge Function failed');
        }
        
        // Check if the response indicates an error
        if (data && !data.success) {
          console.error("[UserDeletion] Delete operation error:", data);
          const errorObj = new Error(JSON.stringify({
            code: data.code || 'UNKNOWN_ERROR',
            error: data.error || 'Deletion failed',
            isRetryable: data.isRetryable || false,
            status: 500
          }));
          throw errorObj;
        }

        console.log(`[UserDeletion] Successfully deleted user ${userId} via Edge Function`);
        return {
          success: true,
          message: data.message || `User ${email} has been deleted successfully${data?.data?.transactionDuration ? ` (${data.data.transactionDuration}ms)` : ''}`,
          data: data.data,
          code: 'SUCCESS'
        };
      } catch (edgeFunctionError: any) {
        console.warn('[UserDeletion] Edge Function failed, attempting fallback to Admin API:', edgeFunctionError.message);
        
        // Fallback method: Direct Supabase Admin API
        try {
          // First delete user data via RPC
          const { data: rpcData, error: rpcError } = await supabase.rpc('admin_delete_user_data', {
            target_user_id: userId
          });

          if (rpcError) {
            console.error('[UserDeletion] RPC deletion error:', rpcError);
            throw new Error(`Database deletion failed: ${rpcError.message}`);
          }

          // Type assertion for the RPC response
          const typedRpcData = rpcData as { success: boolean; error?: string } | null;

          if (!typedRpcData?.success) {
            throw new Error(typedRpcData?.error || 'Database deletion returned failure');
          }

          console.log(`[UserDeletion] Database cleanup completed for ${userId}`);

          // Then delete auth user
          const { error: authError } = await supabase.auth.admin.deleteUser(userId);
          
          if (authError) {
            console.error('[UserDeletion] Auth deletion error:', authError);
            throw new Error(`Auth deletion failed: ${authError.message}`);
          }

          console.log(`[UserDeletion] Successfully deleted user ${userId} via fallback method`);
          return {
            success: true,
            message: `User ${email} has been deleted successfully (fallback method)`,
            data: { fallbackUsed: true }
          };
        } catch (fallbackError: any) {
          console.error('[UserDeletion] Fallback deletion also failed:', fallbackError);
          throw new Error(`Deletion failed: ${edgeFunctionError.message}. Fallback also failed: ${fallbackError.message}`);
        }
      }
    },
    retry: (failureCount, error: any) => {
      const categorized = categorizeDeletionError(error);
      
      // Don't retry non-retryable errors
      if (!categorized.isRetryable) {
        console.log(`[UserDeletion] Not retrying non-retryable error: ${categorized.code}`);
        return false;
      }

      // Don't retry permission, rate limit, or user not found errors
      const nonRetryableCodes = ['INSUFFICIENT_PERMISSIONS', 'RATE_LIMIT_EXCEEDED', 'USER_NOT_FOUND', 'INVALID_INPUT'];
      if (nonRetryableCodes.includes(categorized.code || '')) {
        console.log(`[UserDeletion] Not retrying error code: ${categorized.code}`);
        return false;
      }

      // Retry transient errors up to 2 times
      const shouldRetry = failureCount < 2;
      console.log(`[UserDeletion] Retry decision for ${categorized.code}: ${shouldRetry} (attempt ${failureCount + 1})`);
      return shouldRetry;
    },
    retryDelay: (attemptIndex) => {
      const delay = Math.pow(2, attemptIndex) * 1000; // 1s, 2s, 4s
      console.log(`[UserDeletion] Retrying in ${delay}ms...`);
      return delay;
    },
    onMutate: async ({ userId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['admin-users'] });

      // Snapshot the previous value
      const previousUsers = queryClient.getQueriesData({ queryKey: ['admin-users'] });

      // Optimistically remove the user from the list
      queryClient.setQueriesData({ queryKey: ['admin-users'] }, (old: any) => {
        if (!old) return old;
        
        return {
          ...old,
          users: old.users.filter((user: any) => user.id !== userId),
          total: Math.max(0, old.total - 1)
        };
      });

      return { previousUsers };
    },
    onError: (error: any, { email, userId }, context) => {
      // Rollback optimistic update
      if (context?.previousUsers) {
        context.previousUsers.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      console.error(`[UserDeletion] Error deleting user ${userId}:`, error);
      
      // Categorize the error for better UX
      const categorizedError = categorizeDeletionError(error);
      setLastError(categorizedError);
      
      // Map error codes to user-friendly messages and actions
      let toastTitle = "Deletion failed";
      let toastDescription = categorizedError.message;
      let toastDuration = 7000;
      
      switch (categorizedError.code) {
        case 'FK_VIOLATION':
          toastTitle = "Database Constraint Error";
          toastDescription = "Cannot delete due to database references. Open the deletion dialog to see SQL commands for manual deletion.";
          break;
          
        case 'USER_NOT_FOUND':
          toastTitle = "User Not Found";
          toastDescription = "User may have been deleted already or doesn't exist.";
          toastDuration = 5000;
          break;
          
        case 'INSUFFICIENT_PERMISSIONS':
          toastTitle = "Permission Denied";
          toastDescription = "Only super admin can delete this user. Contact support@jojoprompts.com for assistance.";
          break;
          
        case 'RATE_LIMIT_EXCEEDED':
          toastTitle = "Too Many Requests";
          toastDescription = "Rate limit exceeded. Please wait a few minutes before trying again.";
          toastDuration = 5000;
          break;
          
        case 'DATABASE_ERROR':
          toastTitle = "Database Error";
          toastDescription = "Database error occurred. Open the deletion dialog for manual deletion instructions.";
          break;
          
        case 'NETWORK_ERROR':
          toastTitle = "Network Error";
          toastDescription = categorizedError.isRetryable 
            ? "Connection failed. The system will retry automatically."
            : "Connection failed. Please check your internet and try again.";
          toastDuration = 5000;
          break;
          
        default:
          // For unknown errors, provide helpful fallback
          toastDescription = `${categorizedError.message}. ${categorizedError.isRetryable ? 'You can try again.' : 'Open the deletion dialog for manual steps or contact support@jojoprompts.com'}`;
      }
      
      toast({
        title: toastTitle,
        description: toastDescription,
        variant: "destructive",
        duration: toastDuration
      });
    },
    onSuccess: (result) => {
      // Clear any previous errors on success
      setLastError(null);
      
      toast({
        title: "✅ User deleted successfully",
        description: result.message || "User has been permanently removed from the system.",
        duration: 5000
      });

      // Invalidate and refetch users query
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const showDeleteDialog = useCallback((user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
  }) => {
    setUserToDelete(user);
    setDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (userToDelete) {
      deleteMutation.mutate({ userId: userToDelete.id, email: userToDelete.email });
      setDialogOpen(false);
    }
  }, [userToDelete, deleteMutation]);

  const DeleteDialogComponent = () => (
    <DeleteUserDialog
      open={dialogOpen}
      onOpenChange={(open) => {
        setDialogOpen(open);
        // Clear error when dialog is closed
        if (!open) {
          setLastError(null);
        }
      }}
      user={userToDelete}
      onConfirm={handleConfirmDelete}
      isDeleting={deleteMutation.isPending}
      lastError={lastError}
    />
  );

  return {
    deleteUser: (userId: string, email: string) => 
      deleteMutation.mutateAsync({ userId, email }),
    showDeleteDialog,
    DeleteDialog: DeleteDialogComponent,
    processingUserId: deleteMutation.isPending ? deleteMutation.variables?.userId : null,
    isLoading: deleteMutation.isPending,
    error: deleteMutation.error?.message || null
  };
}
