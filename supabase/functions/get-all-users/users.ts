import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from './cors.ts';
import { safeDelete, logStep } from './dbUtils.ts';
import { deleteUser as deleteUserFn } from './userDeletion.ts';
import { updateUser as updateUserFn } from './userUpdate.ts';
import { createUser as createUserFn } from './userCreate.ts';

/**
 * List all users with their profile info.
 */
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

    // Combine the data - only include users who have profiles
    const combinedUsers = users.users
      .filter(user => profileMap.has(user.id)) // Only include users with profiles
      .map(user => {
        const profile = profileMap.get(user.id);
        
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

/**
 * Delete user and associated data.
 */
export const deleteUser = deleteUserFn;

/**
 * Update user details and profile.
 */
export const updateUser = updateUserFn;

/**
 * Create a new user and associated profile.
 */
export const createUser = createUserFn;
