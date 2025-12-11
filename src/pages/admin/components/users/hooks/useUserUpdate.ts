
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { UserUpdateData } from "@/types/user";
import { createLogger } from '@/utils/logging';
import { handleError } from '@/utils/errorHandler';

const logger = createLogger('USER_UPDATE');

// Transform frontend field names to edge function expected format
function transformDataForEdgeFunction(data: UserUpdateData) {
  const transformed: Record<string, any> = {};
  
  if (data.first_name !== undefined) transformed.firstName = data.first_name;
  if (data.last_name !== undefined) transformed.lastName = data.last_name;
  if (data.username !== undefined) transformed.username = data.username;
  if (data.email !== undefined) transformed.email = data.email;
  if (data.role !== undefined) transformed.role = data.role;
  if (data.bio !== undefined) transformed.bio = data.bio;
  if (data.avatar_url !== undefined) transformed.avatarUrl = data.avatar_url;
  if (data.country !== undefined) transformed.country = data.country;
  if (data.phone_number !== undefined) transformed.phoneNumber = data.phone_number;
  if (data.timezone !== undefined) transformed.timezone = data.timezone;
  if (data.membership_tier !== undefined) transformed.membershipTier = data.membership_tier;
  if (data.social_links !== undefined) transformed.socialLinks = data.social_links;
  if (data.email_confirmed !== undefined) transformed.emailConfirmed = data.email_confirmed;
  if (data.account_status !== undefined) transformed.accountStatus = data.account_status;
  
  return transformed;
}

export function useUserUpdate() {
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);

  const handleUpdateUser = async (userId: string, data: UserUpdateData) => {
    setProcessingUserId(userId);
    
    try {
      // Transform data for edge function
      const transformedData = transformDataForEdgeFunction(data);
      
      // Call edge function which handles all updates including auth-related fields
      const { data: result, error } = await supabase.functions.invoke('get-all-users', {
        body: {
          action: 'update',
          userId,
          ...transformedData
        }
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to update user');
      }
      
      if (result?.error) {
        throw new Error(result.error);
      }
      
      toast({
        title: "User updated",
        description: "User information has been updated successfully."
      });
      
      logger.info('User updated successfully', { userId, fields: Object.keys(data) });
      return true;
      
    } catch (error: any) {
      const appError = handleError(error, { component: 'useUserUpdate', action: 'updateUser' });
      logger.error('Error updating user', { error: appError, userId });
      
      toast({
        title: "Update failed",
        description: error.message || "Failed to update user information.",
        variant: "destructive"
      });
      return false;
    } finally {
      setProcessingUserId(null);
    }
  };

  return {
    processingUserId,
    updateUser: handleUpdateUser
  };
}
