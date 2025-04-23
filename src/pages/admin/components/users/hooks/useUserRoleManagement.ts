
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function useUserRoleManagement() {
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      setUpdatingUserId(userId);
      
      // First verify if the role actually changed in the database
      const { data: currentData, error: fetchError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
        
      if (fetchError) throw fetchError;
      
      // Only update if the role is actually different
      if (currentData?.role !== newRole) {
        const { error } = await supabase
          .from('profiles')
          .update({ role: newRole })
          .eq('id', userId);
          
        if (error) throw error;
        
        // Verify the update was successful
        const { data: verifyData, error: verifyError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single();
          
        if (verifyError) throw verifyError;
        
        if (verifyData?.role !== newRole) {
          throw new Error(`Role update failed: Database shows role as ${verifyData?.role}`);
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
