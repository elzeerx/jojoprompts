import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAdminErrorHandler } from "./useAdminErrorHandler";

interface UpdateUserData {
  userId: string;
  updates: {
    first_name?: string;
    last_name?: string;
    role?: string;
    username?: string;
    bio?: string;
    country?: string;
    phone_number?: string;
    email?: string;
    password?: string;
  };
}

export function useUserUpdate() {
  const [isUpdating, setIsUpdating] = useState(false);
  const { handleError } = useAdminErrorHandler();

  const updateUser = async (userData: UpdateUserData) => {
    try {
      setIsUpdating(true);
      
      // Use edge function to update user
      const { data, error } = await supabase.functions.invoke(
        "get-all-users",
        {
          body: { 
            action: "update",
            userId: userData.userId,
            updates: userData.updates
          }
        }
      );
      
      if (error) {
        console.error("Edge function error:", error);
        throw new Error(error.message || "Failed to invoke user update function");
      }
      
      if (data?.error) {
        throw new Error(data.error || "Failed to update user");
      }
      
      if (!data?.success) {
        throw new Error("User update failed");
      }
      
      toast({
        title: "Success",
        description: "User updated successfully",
      });
      
      return true;
    } catch (error: any) {
      handleError(error, "update user");
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    isUpdating,
    updateUser
  };
}