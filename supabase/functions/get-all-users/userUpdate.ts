
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

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
  console.log(`[userUpdate] Admin ${adminId} is attempting to update user ${userId}`, userData);
  try {
    let updateResult = { user: null, profileData: null };

    if (userData.email) {
      const { data: authUpdate, error: updateError } = await supabase.auth.admin.updateUserById(
        userId,
        { email: userData.email }
      );

      if (updateError) {
        console.error(`[userUpdate] Error updating user ${userId}:`, updateError);
        throw new Error(`Error updating user email: ${updateError.message}`);
      }

      updateResult.user = authUpdate.user;
      console.log(`[userUpdate] Successfully updated user email for ${userId}`);
    }

    if (userData.first_name !== undefined || userData.last_name !== undefined || userData.role !== undefined) {
      const updateData: Partial<UserData> = {};
      if (userData.first_name !== undefined) updateData.first_name = userData.first_name;
      if (userData.last_name !== undefined) updateData.last_name = userData.last_name;
      if (userData.role !== undefined) updateData.role = userData.role;

      console.log(`[userUpdate] Updating profile data for user ${userId}:`, updateData);

      const { data: profileUpdate, error: profileUpdateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId)
        .select();

      if (profileUpdateError) {
        console.error(`[userUpdate] Error updating profile for ${userId}:`, profileUpdateError);
        throw new Error(`Error updating user profile: ${profileUpdateError.message}`);
      }

      updateResult.profileData = profileUpdate;
      console.log(`[userUpdate] Successfully updated profile for ${userId}:`, profileUpdate);
    }

    return {
      success: true,
      message: 'User updated successfully',
      data: updateResult
    };
  } catch (error) {
    console.error(`[userUpdate] Error in updateUser:`, error);
    throw error;
  }
}
