import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { createEdgeLogger } from '../_shared/logger.ts';

const logger = createEdgeLogger('get-all-users:userUpdate');

interface UserData {
  email?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
}

export async function updateUser(
  supabase: ReturnType<typeof createClient>, 
  userId: string, 
  userData: UserData,
  adminId: string
) {
  logger.info('Admin attempting to update user', { adminId, userId, fields: Object.keys(userData) });
  try {
    let updateResult = { user: null, profileData: null };

    if (userData.email) {
      const { data: authUpdate, error: updateError } = await supabase.auth.admin.updateUserById(
        userId,
        { email: userData.email }
      );

      if (updateError) {
        logger.error('Error updating user email', { error: updateError.message, userId });
        throw new Error(`Error updating user email: ${updateError.message}`);
      }

      updateResult.user = authUpdate.user;
      logger.info('Successfully updated user email', { userId, newEmail: userData.email });
    }

    if (userData.first_name !== undefined || userData.last_name !== undefined || userData.role !== undefined) {
      const updateData: Partial<UserData> = {};
      if (userData.first_name !== undefined) updateData.first_name = userData.first_name;
      if (userData.last_name !== undefined) updateData.last_name = userData.last_name;
      if (userData.role !== undefined) updateData.role = userData.role;

      logger.info('Updating profile data for user', { userId, fields: Object.keys(updateData) });

      const { data: profileUpdate, error: profileUpdateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId)
        .select();

      if (profileUpdateError) {
        logger.error('Error updating profile', { error: profileUpdateError.message, userId });
        throw new Error(`Error updating user profile: ${profileUpdateError.message}`);
      }

      updateResult.profileData = profileUpdate;
      logger.info('Successfully updated profile', { userId, updatedFields: Object.keys(updateData) });
    }

    return {
      success: true,
      message: 'User updated successfully',
      data: updateResult
    };
  } catch (error) {
    logger.error('Error in updateUser', { error, userId });
    throw error;
  }
}
