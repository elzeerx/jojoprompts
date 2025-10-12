import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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
      console.log(`[UserDeletion] Attempting to delete user ${userId} via direct database call`);
      
      // Call the database function directly (bypassing edge functions)
      const { data, error } = await supabase.rpc('admin_delete_user_data', {
        target_user_id: userId
      });
      
      if (error) {
        console.error("[UserDeletion] Database error:", error);
        throw new Error(error.message || 'Failed to delete user');
      }
      
      // Cast data to proper type
      const response = data as unknown as DeleteUserResponse;
      
      // Check if the function returned an error
      if (response && !response.success) {
        console.error("[UserDeletion] Deletion failed:", response.error);
        throw new Error(response.error || 'Failed to delete user');
      }
      
      // Success
      const duration = response?.duration_ms ? ` (${Math.round(response.duration_ms)}ms)` : '';
      toast({
        title: "✅ User deleted",
        description: `User ${email} has been deleted successfully${duration}.`
      });
      
      console.log(`[UserDeletion] User ${userId} deleted successfully:`, response);
      return true;
    } catch (error: any) {
      console.error(`[UserDeletion] Error deleting user:`, error);
      
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