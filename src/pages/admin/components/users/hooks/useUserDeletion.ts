import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function useUserDeletion() {
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);

  const handleDeleteUser = async (userId: string, email: string, retryCount = 0) => {
    const maxRetries = 2;
    setProcessingUserId(userId);
    
    try {
      console.log(`Attempting to delete user ${userId} (attempt ${retryCount + 1})`);
      
      const { data, error } = await supabase.functions.invoke('get-all-users', {
        body: {
          action: 'delete',
          userId
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
      
      // Enhanced success feedback
      const duration = data?.transactionDuration ? ` (${data.transactionDuration}ms)` : '';
      toast({
        title: "User deleted",
        description: `User ${email} has been deleted successfully${duration}.`
      });
      
      console.log(`User ${userId} deleted successfully:`, data);
      return true;
    } catch (error: any) {
      console.error(`Error deleting user (attempt ${retryCount + 1}):`, error);
      
      // Implement retry logic for transient failures
      const isTransientError = error.message?.includes("Edge Function returned a non-2xx status code") ||
                              error.message?.includes("network") ||
                              error.message?.includes("timeout") ||
                              error.message?.includes("connection");
      
      if (isTransientError && retryCount < maxRetries) {
        console.log(`Retrying deletion for user ${userId} (attempt ${retryCount + 2})`);
        
        // Wait before retry with exponential backoff
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Recursive retry
        return handleDeleteUser(userId, email, retryCount + 1);
      }
      
      // Parse error message more specifically
      let errorMessage = "Failed to delete user.";
      
      if (error.message) {
        if (error.message.includes("Edge Function returned a non-2xx status code")) {
          errorMessage = retryCount > 0 
            ? `Server error persisted after ${retryCount + 1} attempts. Please contact support.`
            : "Server error occurred. Please try again or contact support.";
        } else if (error.message.includes("User not found")) {
          errorMessage = "User not found in database.";
        } else if (error.message.includes("Invalid user ID")) {
          errorMessage = "Invalid user ID provided.";
        } else if (error.message.includes("Cannot delete another administrator")) {
          errorMessage = "Cannot delete another administrator for security reasons.";
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