
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useUserRoleManagement } from "./useUserRoleManagement";
import { validateRole } from "@/utils/roleValidation";
import { UserUpdateData, UserRole } from "@/types/user";

export function useUserUpdate() {
  const { updatingUserId, updateUserRole } = useUserRoleManagement();
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);

  const handleUpdateUser = async (userId: string, data: UserUpdateData) => {
    setProcessingUserId(userId);
    
    try {
      let updated = false;
      
      // Update roles if changed
      if (data.role) {
        const roleValidation = validateRole(data.role);
        if (!roleValidation.isValid) {
          throw new Error(roleValidation.error);
        }
        
        await updateUserRole(userId, data.role);
        updated = true;
      }

      // Update user profile data
      if (data.first_name !== undefined || data.last_name !== undefined) {
        const { error } = await supabase
          .from('profiles')
          .update({
            first_name: data.first_name,
            last_name: data.last_name,
          })
          .eq('id', userId);

        if (error) throw error;
        updated = true;
      }

      // Update user email if provided
      if (data.email) {
        const { error } = await supabase.functions.invoke(
          "get-all-users",
          {
            body: {
              action: 'update',
              userId,
              userData: { email: data.email }
            }
          }
        );

        if (error) throw error;
        updated = true;
      }
      
      if (updated) {
        toast({
          title: "User updated",
          description: "User information has been updated successfully."
        });
        
        return true;
      }
    } catch (error: any) {
      console.error("Error updating user:", error);
      
      toast({
        title: "Update failed",
        description: error.message || "Failed to update user information.",
        variant: "destructive"
      });
    } finally {
      setProcessingUserId(null);
    }
  };

  return {
    processingUserId: processingUserId || updatingUserId,
    updateUser: handleUpdateUser
  };
}
