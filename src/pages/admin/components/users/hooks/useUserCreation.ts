
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAdminErrorHandler } from "./useAdminErrorHandler";
import { CreateUserData } from "@/types/user";

export function useUserCreation() {
  const [isCreating, setIsCreating] = useState(false);
  const { handleError } = useAdminErrorHandler();

  const createUser = async (userData: CreateUserData) => {
    try {
      setIsCreating(true);
      
      // Use Supabase RPC to create user (admin function)
      const { data, error } = await supabase.rpc('admin_create_user' as any, {
        user_email: userData.email,
        user_password: userData.password,
        user_first_name: userData.first_name || 'User',
        user_last_name: userData.last_name || '',
        user_role: userData.role || 'user'
      }) as { data: any, error: any };
      
      if (error) {
        console.error("RPC error:", error);
        throw new Error(error.message || "Failed to create user");
      }
      
      if (!data) {
        throw new Error("User creation failed - no user ID returned");
      }
      
      toast({
        title: "Success",
        description: `User ${userData.email} created successfully`,
      });
      
      return true;
    } catch (error: any) {
      handleError(error, "create user");
      return false;
    } finally {
      setIsCreating(false);
    }
  };

  return {
    isCreating,
    createUser
  };
}
