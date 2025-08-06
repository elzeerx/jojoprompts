import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function useUserDeletion() {
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);

  const handleDeleteUser = async (userId: string, email: string) => {
    setProcessingUserId(userId);
    
    try {
      const { data, error } = await supabase.functions.invoke('get-all-users', {
        body: {
          action: 'delete',
          userId
        }
      });
      
      if (error) throw new Error(error?.message || 'Failed to delete user');
      
      // Check if the response indicates an error
      if (data && data.error) {
        throw new Error(data.error);
      }
      
      toast({
        title: "User deleted",
        description: `User ${email} has been deleted successfully.`
      });
      
      return true;
    } catch (error: any) {
      console.error("Error deleting user:", error);
      
      // Parse error message more specifically
      let errorMessage = "Failed to delete user.";
      
      if (error.message) {
        if (error.message.includes("Edge Function returned a non-2xx status code")) {
          errorMessage = "Server error occurred. Please try again or contact support.";
        } else if (error.message.includes("User not found")) {
          errorMessage = "User not found in database.";
        } else if (error.message.includes("Invalid user ID")) {
          errorMessage = "Invalid user ID provided.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Deletion failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setProcessingUserId(null);
    }
  };

  return {
    processingUserId,
    deleteUser: handleDeleteUser
  };
}