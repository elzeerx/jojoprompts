import React, { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { DeleteUserDialog } from "@/components/admin/DeleteUserDialog";

interface UserDeletionResult {
  success: boolean;
  message?: string;
  data?: any;
}

export function useUserDeletion() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
  } | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async ({ userId, email }: { userId: string; email: string }): Promise<UserDeletionResult> => {
      console.log(`Attempting to delete user ${userId}`);
      
      const { data, error } = await supabase.functions.invoke('get-all-users', {
        body: {
          action: 'delete',
          userId,
          ip_address: window.location.hostname,
          user_agent: navigator.userAgent
        }
      });
      
      if (error) {
        console.error("Supabase function error:", error);
        throw new Error(error?.message || 'Failed to delete user');
      }
      
      // Check if the response indicates an error
      if (data && data.error) {
        console.error("Delete operation error:", data.error);
        throw new Error(data.error);
      }

      return {
        success: true,
        message: `User ${email} has been deleted successfully${data?.transactionDuration ? ` (${data.transactionDuration}ms)` : ''}`,
        data
      };
    },
    retry: (failureCount, error) => {
      // Don't retry rate limit or permission errors
      if (error?.message?.includes("Too many deletion attempts") ||
          error?.message?.includes("Only super admin") ||
          error?.message?.includes("Permission denied")) {
        return false;
      }

      // Implement retry logic for transient failures
      const isTransientError = error?.message?.includes("Edge Function returned a non-2xx status code") ||
                              error?.message?.includes("network") ||
                              error?.message?.includes("timeout") ||
                              error?.message?.includes("connection");
      
      return isTransientError && failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.pow(2, attemptIndex) * 1000, // 1s, 2s, 4s
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

      console.error(`Error deleting user ${userId}:`, error);
      
      // Parse error message more specifically
      let errorMessage = "Failed to delete user.";
      
      if (error.message) {
        if (error.message.includes("Too many deletion attempts")) {
          errorMessage = "Rate limit exceeded. Please wait before deleting more users.";
        } else if (error.message.includes("Only super admin")) {
          errorMessage = "Only the super administrator can delete admin accounts.";
        } else if (error.message.includes("Permission denied")) {
          errorMessage = "You don't have permission to delete this user.";
        } else if (error.message.includes("Edge Function returned a non-2xx status code")) {
          errorMessage = "Server error occurred. Please try again or contact support.";
        } else if (error.message.includes("User not found")) {
          errorMessage = "User not found in database.";
        } else if (error.message.includes("Invalid user ID")) {
          errorMessage = "Invalid user ID provided.";
        } else if (error.message.includes("transaction")) {
          errorMessage = "Database transaction failed. Please try again.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Deletion failed",
        description: errorMessage,
        variant: "destructive"
      });
    },
    onSuccess: (result) => {
      toast({
        title: "User deleted",
        description: result.message
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
      onOpenChange={setDialogOpen}
      user={userToDelete}
      onConfirm={handleConfirmDelete}
      isDeleting={deleteMutation.isPending}
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
