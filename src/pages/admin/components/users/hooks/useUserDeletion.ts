import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { createLogger } from '@/utils/logging';
import { handleError } from '@/utils/errorHandler';

const logger = createLogger('USER_DELETION');

interface DeleteUserResponse {
  success: boolean;
  error?: string;
  duration_ms?: number;
  deleted_user_id?: string;
}

export function useUserDeletion() {
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);

  const handleDeleteUser = async (userId: string, email: string) => {
    setProcessingUserId(userId);
    
    try {
      logger.info('Attempting to delete user via edge function', { userId });
      
      // Call the edge function which handles both profile data AND auth user deletion
      const { data, error } = await supabase.functions.invoke('get-all-users', {
        body: { action: 'delete', userId }
      });
      
      if (error) {
        logger.error('Edge function error', { error: error.message, userId });
        throw new Error(error.message || 'Failed to delete user');
      }
      
      // Check if the function returned an error
      if (data && !data.success) {
        logger.error('Deletion failed', { error: data.error, userId });
        throw new Error(data.error || 'Failed to delete user');
      }
      
      // Success
      const duration = data?.duration_ms ? ` (${Math.round(data.duration_ms)}ms)` : '';
      toast({
        title: "✅ User deleted",
        description: `User ${email} has been deleted successfully${duration}.`
      });
      
      logger.info('User deleted successfully', { userId, duration: data?.duration_ms });
      return true;
    } catch (error: any) {
      const appError = handleError(error, { component: 'useUserDeletion', action: 'deleteUser' });
      logger.error('Error deleting user', { error: appError, userId });
      
      // Parse error message more specifically
      let errorMessage = "Failed to delete user.";
      
      if (error.message) {
        if (error.message.includes("Admin access required") || error.message.includes("UNAUTHORIZED")) {
          errorMessage = "You don't have permission to delete users. Please log in as an admin.";
        } else if (error.message.includes("User not found") || error.message.includes("USER_NOT_FOUND")) {
          errorMessage = "User not found in database.";
        } else if (error.message.includes("foreign key") || error.message.includes("FK_VIOLATION")) {
          errorMessage = "Cannot delete user due to existing references. Try using the SQL commands in the delete dialog.";
        } else if (error.message.includes("permission denied")) {
          errorMessage = "Database permission denied. Check RLS policies.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "❌ Deletion failed",
        description: errorMessage,
        variant: "destructive"
      });
      
      return false;
    } finally {
      setProcessingUserId(null);
    }
  };

  return {
    processingUserId,
    deleteUser: handleDeleteUser
  };
}