import { callEdgeFunction } from "@/utils/edgeFunctions";

/**
 * Admin utility to delete specific users completely from the system
 */
export async function deleteUsersCompletely(emails: string[]) {
  const results = [];
  
  for (const email of emails) {
    try {
      console.log(`Starting deletion for user: ${email}`);
      
      // Call the Edge Function to delete the user
      const result = await callEdgeFunction('get-all-users', {
        action: 'delete',
        userEmail: email // We'll need to modify the Edge Function to accept email
      });
      
      console.log(`Successfully deleted user: ${email}`, result);
      results.push({ email, success: true, result });
      
    } catch (error) {
      console.error(`Failed to delete user: ${email}`, error);
      results.push({ email, success: false, error: error.message });
    }
  }
  
  return results;
}

/**
 * Delete users by their user IDs
 */
export async function deleteUsersByIds(userIds: string[]) {
  const results = [];
  
  for (const userId of userIds) {
    try {
      console.log(`Starting deletion for user ID: ${userId}`);
      
      // Call the Edge Function to delete the user by ID
      const result = await callEdgeFunction('get-all-users', {
        action: 'delete',
        userId: userId
      });
      
      console.log(`Successfully deleted user ID: ${userId}`, result);
      results.push({ userId, success: true, result });
      
    } catch (error) {
      console.error(`Failed to delete user ID: ${userId}`, error);
      results.push({ userId, success: false, error: error.message });
    }
  }
  
  return results;
}