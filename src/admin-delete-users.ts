import { supabase } from "@/integrations/supabase/client";
import { deleteUsersByIds } from "@/utils/adminUserDeletion";

/**
 * ADMIN SCRIPT: Delete specific users completely
 * Run this in the browser console on the admin page
 */
export async function deleteTargetUsers() {
  const targetEmails = [
    'n@stayfoolish.com',
    'nawaf9610@gmail.com'
  ];
  
  console.log('🔍 Finding users to delete...', targetEmails);
  
  // First, find the user IDs for these emails
  const userIds = [];
  
  for (const email of targetEmails) {
    try {
      // Get user data from profiles table first
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('id', '(SELECT id FROM auth.users WHERE email = \'' + email + '\')')
        .single();
        
      if (profileError || !profile) {
        console.log(`❌ User not found in profiles: ${email}`);
        
        // Try to get from auth users directly
        const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
        if (!authError && authUsers?.users) {
          const authUser = authUsers.users.find((u: any) => u.email === email);
          if (authUser) {
            userIds.push(authUser.id);
            console.log(`✅ Found user in auth: ${email} with ID: ${authUser.id}`);
          }
        }
        continue;
      }
      
      userIds.push(profile.id);
      console.log(`✅ Found user: ${email} with ID: ${profile.id}`);
    } catch (error) {
      console.error(`Error finding user ${email}:`, error);
    }
  }
  
  if (userIds.length === 0) {
    console.log('❌ No users found to delete');
    return;
  }
  
  console.log(`🗑️  Deleting ${userIds.length} users...`);
  
  // Delete the users
  const results = await deleteUsersByIds(userIds);
  
  console.log('🏁 Deletion Results:');
  results.forEach(result => {
    if (result.success) {
      console.log(`✅ Successfully deleted user ID: ${result.userId}`);
    } else {
      console.error(`❌ Failed to delete user ID: ${result.userId}`, result.error);
    }
  });
  
  return results;
}

// Make it available globally for easy access
if (typeof window !== 'undefined') {
  (window as any).deleteTargetUsers = deleteTargetUsers;
}