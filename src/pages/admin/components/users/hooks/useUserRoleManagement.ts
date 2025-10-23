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
      
      // First check if profile exists
      const { data: currentData, error: fetchError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
        
      if (fetchError) {
        const appError = handleError(fetchError, { component: 'useUserRoleManagement', action: 'fetchCurrentRole' });
        logger.error('Error fetching current role', { error: appError, userId });
        throw new Error(`Failed to verify current role: ${fetchError.message}`);
      }
      
      // If profile doesn't exist, create it
      if (!currentData) {
        logger.info('Profile not found, creating new profile', { userId, newRole });
        
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({ 
            id: userId, 
            role: newRole,
            first_name: 'User', // Default first name for new profile
            last_name: '', // Default empty last name for new profile
            username: `user_${userId.substring(0, 8)}` // Generate username from user ID
          });
          
        if (insertError) {
          const appError = handleError(insertError, { component: 'useUserRoleManagement', action: 'createProfile' });
          logger.error('Error creating profile', { error: appError, userId });
          throw new Error(`Failed to create user profile: ${insertError.message}`);
        }
        
        toast({
          title: "Profile created",
          description: `New user profile has been created with role ${newRole}`,
        });
        
        return true;
      }
      
      logger.debug('Current role data', { currentRole: currentData.role, userId });
      
      // Only update if the role is actually different
      if (currentData.role !== newRole) {
        logger.info('Updating role', { userId, fromRole: currentData.role, toRole: newRole });
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ role: newRole })
          .eq('id', userId);
          
        if (updateError) {
          const appError = handleError(updateError, { component: 'useUserRoleManagement', action: 'updateRole' });
          logger.error('Error updating role', { error: appError, userId });
          throw new Error(`Failed to update role: ${updateError.message}`);
        }
        
        logger.debug('Role update success, verifying');
        
        // Wait a moment before verifying to ensure database consistency
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Verify the update was successful - use maybeSingle() to avoid JSON errors
        const { data: verifyData, error: verifyError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle();
          
        if (verifyError) {
          const appError = handleError(verifyError, { component: 'useUserRoleManagement', action: 'verifyRoleUpdate' });
          logger.error('Error verifying role update', { error: appError, userId });
          throw new Error(`Failed to verify role update: ${verifyError.message}`);
        }
        
        if (!verifyData) {
          throw new Error("User profile not found after update");
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
