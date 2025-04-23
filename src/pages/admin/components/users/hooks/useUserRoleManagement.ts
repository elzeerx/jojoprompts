
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function useUserRoleManagement() {
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      setUpdatingUserId(userId);
      
      // First verify if the role actually changed in the database - use maybeSingle() to avoid JSON errors
      const { data: currentData, error: fetchError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
        
      if (fetchError) {
        console.error("Error fetching current role:", fetchError);
        throw new Error(`Failed to verify current role: ${fetchError.message}`);
      }
      
      if (!currentData) {
        throw new Error("User profile not found");
      }
      
      console.log("Current role data:", currentData);
      
      // Only update if the role is actually different
      if (currentData.role !== newRole) {
        console.log(`Updating role for user ${userId} from ${currentData.role} to ${newRole}`);
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ role: newRole })
          .eq('id', userId);
          
        if (updateError) {
          console.error("Error updating role:", updateError);
          throw new Error(`Failed to update role: ${updateError.message}`);
        }
        
        console.log("Role update success, verifying...");
        
        // Wait a moment before verifying to ensure database consistency
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Verify the update was successful - use maybeSingle() to avoid JSON errors
        const { data: verifyData, error: verifyError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle();
          
        if (verifyError) {
          console.error("Error verifying role update:", verifyError);
          throw new Error(`Failed to verify role update: ${verifyError.message}`);
        }
        
        if (!verifyData) {
          throw new Error("User profile not found after update");
        }
        
        console.log("Verification data:", verifyData);
        
        if (verifyData.role !== newRole) {
          throw new Error(`Role update failed: Database shows role as ${verifyData.role}`);
        }
        
        toast({
          title: "Role updated",
          description: `User role has been changed to ${newRole}`,
        });
        
        return true;
      } else {
        // Role was already set to the requested value
        toast({
          title: "No change needed",
          description: `User already has the role ${newRole}`,
        });
        return true;
      }
    } catch (error: any) {
      console.error("Error updating user role:", error);
      toast({
        title: "Error updating role",
        description: error.message || "Failed to update user role",
        variant: "destructive",
      });
      return false;
    } finally {
      setUpdatingUserId(null);
    }
  };

  return { updatingUserId, updateUserRole };
}
