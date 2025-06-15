import { corsHeaders } from './cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { safeDelete, logStep } from './dbUtils.ts';

interface UserData {
  email?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
}

export async function listUsers(supabase: ReturnType<typeof createClient>, adminId: string) {
  console.log(`Admin ${adminId} is fetching all users`);
  
  try {
    // First get all users from auth
    const { data: users, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('Error listing auth users:', authError);
      throw new Error(`Error fetching auth users: ${authError.message}`);
    }

    // Handle empty users array properly
    if (!users || !users.users || users.users.length === 0) {
      console.log('No users found in auth.users');
      return { users: [] };
    }

    // Get all profiles in one query
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, first_name, last_name');

    if (profileError) {
      console.error('Error fetching profiles:', profileError);
      throw new Error(`Error fetching profiles: ${profileError.message}`);
    }

    // Create a map of profiles for efficient lookup
    const profileMap = new Map(profiles?.map(profile => [profile.id, profile]) || []);

    // Combine the data
    const combinedUsers = users.users.map(user => {
      const profile = profileMap.get(user.id) || { role: 'user', first_name: null, last_name: null };
      
      console.log(`Combining data for user ${user.id}:`, { 
        auth: user,
        profile: profile 
      });
      
      return {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        first_name: profile.first_name,
        last_name: profile.last_name,
        role: profile.role || 'user'
      };
    });

    console.log('Final combined users data:', combinedUsers);
    return { users: combinedUsers };
  } catch (error) {
    console.error('Error in listUsers:', error);
    throw error;
  }
}

export async function deleteUser(supabase: ReturnType<typeof createClient>, userId: string, adminId: string) {
  console.log(`Admin ${adminId} is attempting to delete user ${userId}`);
  try {
    // Deletion order respects all foreign keys and covers all major user data
    // 1. Collections and related data
    await safeDelete(supabase, 'collection_prompts', 'collection_id', userId); // In case collections are referenced
    await safeDelete(supabase, 'collections', 'user_id', userId);
    // 2. Prompt shared and usage logs
    await safeDelete(supabase, 'prompt_shares', 'shared_by', userId);
    await safeDelete(supabase, 'prompt_usage_history', 'user_id', userId);
    // 3. Subscription and transaction history (subscriptions before transactions to avoid FK error)
    await safeDelete(supabase, 'user_subscriptions', 'user_id', userId); // This must come BEFORE transactions!
    await safeDelete(supabase, 'transactions', 'user_id', userId);
    // 4. App logic-related tables
    await safeDelete(supabase, 'favorites', 'user_id', userId);
    await safeDelete(supabase, 'prompts', 'user_id', userId);
    await safeDelete(supabase, 'discount_code_usage', 'user_id', userId);
    // 5. User's profile (removes via FK from auth.users)
    await safeDelete(supabase, 'profiles', 'id', userId);

    logStep('Deleting user from Auth', userId);
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error(`Error deleting user ${userId} from Auth:`, deleteError);
      throw new Error(`Error deleting user from Auth: ${deleteError.message}`);
    }

    logStep('User deleted successfully', userId);
    return { success: true, message: 'User deleted successfully' };
  } catch (error) {
    // Improved error logging to indicate which step failed
    console.error(`[deleteUser] Error when deleting user ${userId}:`, error);
    throw error;
  }
}

export async function updateUser(
  supabase: ReturnType<typeof createClient>, 
  userId: string, 
  userData: UserData,
  adminId: string
) {
  console.log(`Admin ${adminId} is attempting to update user ${userId}`, userData);
  try {
    let updateResult = { user: null, profileData: null };

    if (userData.email) {
      const { data: authUpdate, error: updateError } = await supabase.auth.admin.updateUserById(
        userId,
        { email: userData.email }
      );

      if (updateError) {
        console.error(`Error updating user ${userId}:`, updateError);
        throw new Error(`Error updating user email: ${updateError.message}`);
      }

      updateResult.user = authUpdate.user;
      console.log(`Successfully updated user email for ${userId}`);
    }

    if (userData.first_name !== undefined || userData.last_name !== undefined || userData.role !== undefined) {
      const updateData: Partial<UserData> = {};
      if (userData.first_name !== undefined) updateData.first_name = userData.first_name;
      if (userData.last_name !== undefined) updateData.last_name = userData.last_name;
      if (userData.role !== undefined) updateData.role = userData.role;

      console.log(`Updating profile data for user ${userId}:`, updateData);

      const { data: profileUpdate, error: profileUpdateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId)
        .select();

      if (profileUpdateError) {
        console.error(`Error updating profile for ${userId}:`, profileUpdateError);
        throw new Error(`Error updating user profile: ${profileUpdateError.message}`);
      }

      updateResult.profileData = profileUpdate;
      console.log(`Successfully updated profile for ${userId}:`, profileUpdate);
    }

    return {
      success: true,
      message: 'User updated successfully',
      data: updateResult
    };
  } catch (error) {
    console.error(`Error in updateUser:`, error);
    throw error;
  }
}

export async function createUser(
  supabase: ReturnType<typeof createClient>,
  userData: UserData,
  adminId: string
) {
  console.log(`Admin ${adminId} is attempting to create a new user`, userData);
  try {
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      user_metadata: {
        first_name: userData.first_name,
        last_name: userData.last_name
      }
    });

    if (createError) {
      console.error(`Error creating user:`, createError);
      throw new Error(`Error creating user: ${createError.message}`);
    }

    if (createData.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: createData.user.id,
          first_name: userData.first_name,
          last_name: userData.last_name,
          role: userData.role || 'user'
        });

      if (profileError) {
        console.error(`Error creating profile for new user:`, profileError);
      }
    }

    console.log(`Successfully created user ${createData.user.id}`);
    return {
      success: true,
      message: 'User created successfully',
      user: createData.user
    };
  } catch (error) {
    console.error(`Error in createUser:`, error);
    throw error;
  }
}
