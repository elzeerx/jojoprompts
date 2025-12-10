import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { UserRole, validateRole } from "@/utils/roleValidation";
import { createLogger } from '@/utils/logging';
import { handleError } from '@/utils/errorHandler';

const logger = createLogger('USER_ROLE_MGMT');

export function useUserRoleManagement() {
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    try {
      setUpdatingUserId(userId);
      
      // Validate the role before proceeding
      const roleValidation = validateRole(newRole);
      if (!roleValidation.isValid) {
        throw new Error(roleValidation.error);
      }
      
      // First check if user exists in profiles
      const { data: profileData, error: profileFetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
        
      if (profileFetchError) {
        const appError = handleError(profileFetchError, { component: 'useUserRoleManagement', action: 'fetchProfile' });
        logger.error('Error fetching profile', { error: appError, userId });
        throw new Error(`Failed to verify user profile: ${profileFetchError.message}`);
      }
      
      // Check current role from user_roles table
      const { data: currentRole, error: fetchError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
        
      if (fetchError) {
        const appError = handleError(fetchError, { component: 'useUserRoleManagement', action: 'fetchCurrentRole' });
        logger.error('Error fetching current role', { error: appError, userId });
        throw new Error(`Failed to verify current role: ${fetchError.message}`);
      }
      
      // If no role exists, insert new role
      if (!currentRole) {
        logger.info('No role found, creating new role entry', { userId, newRole });
        
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert({ 
            user_id: userId, 
            role: newRole,
            assigned_at: new Date().toISOString()
          });
          
        if (insertError) {
          const appError = handleError(insertError, { component: 'useUserRoleManagement', action: 'createRole' });
          logger.error('Error creating role', { error: appError, userId });
          throw new Error(`Failed to create user role: ${insertError.message}`);
        }
        
        toast({
          title: "Role assigned",
          description: `User has been assigned the role ${newRole}`,
        });
        
        return true;
      }
      
      logger.debug('Current role data', { currentRole: currentRole.role, userId });
      
      // Only update if the role is actually different
      if (currentRole.role !== newRole) {
        logger.info('Updating role', { userId, fromRole: currentRole.role, toRole: newRole });
        
        // Delete existing role and insert new one for clean transition
        const { error: deleteError } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId);
          
        if (deleteError) {
          const appError = handleError(deleteError, { component: 'useUserRoleManagement', action: 'deleteOldRole' });
          logger.error('Error deleting old role', { error: appError, userId });
          throw new Error(`Failed to update role: ${deleteError.message}`);
        }
        
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role: newRole,
            assigned_at: new Date().toISOString()
          });
          
        if (insertError) {
          const appError = handleError(insertError, { component: 'useUserRoleManagement', action: 'insertNewRole' });
          logger.error('Error inserting new role', { error: appError, userId });
          throw new Error(`Failed to update role: ${insertError.message}`);
        }
        
        logger.debug('Role update success, verifying');
        
        // Wait a moment before verifying to ensure database consistency
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Verify the update was successful
        const { data: verifyData, error: verifyError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle();
          
        if (verifyError) {
          const appError = handleError(verifyError, { component: 'useUserRoleManagement', action: 'verifyRoleUpdate' });
          logger.error('Error verifying role update', { error: appError, userId });
          throw new Error(`Failed to verify role update: ${verifyError.message}`);
        }
        
        if (!verifyData) {
          throw new Error("User role not found after update");
        }
        
        logger.debug('Verification data', { role: verifyData.role });
        
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
      const appError = handleError(error, { component: 'useUserRoleManagement', action: 'updateUserRole' });
      logger.error('Error updating user role', { error: appError, userId });
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
