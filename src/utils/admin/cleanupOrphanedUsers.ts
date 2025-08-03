import { supabase } from "@/integrations/supabase/client";

/**
 * Clean up orphaned users (auth.users without profiles) using the edge function
 */
export async function cleanupOrphanedUsers() {
  try {
    console.log('Starting orphaned user cleanup...');
    
    // Get orphaned users
    const orphanedUsers = [
      { id: 'd9058f3d-1dcc-427e-b45a-688d686af011', email: 'n@stayfoolish.net' },
      { id: '5869286b-25f9-4c35-bbe8-1ad50f6d8e80', email: 'nawaf9610@gmail.com' },
      { id: '7cce2be7-3a16-475d-9d91-db258cb411ee', email: 'contact@recipe.marketing' }
    ];
    
    const results = [];
    
    for (const user of orphanedUsers) {
      console.log(`Attempting to delete orphaned user: ${user.email} (${user.id})`);
      
      try {
        const { data, error } = await supabase.functions.invoke('get-all-users', {
          body: {
            action: 'delete',
            userId: user.id
          }
        });
        
        if (error) {
          console.error(`Failed to delete ${user.email}:`, error);
          results.push({ user: user.email, status: 'error', error: error.message });
        } else if (data && data.error) {
          console.error(`Edge function error for ${user.email}:`, data.error);
          results.push({ user: user.email, status: 'error', error: data.error });
        } else {
          console.log(`Successfully deleted ${user.email}`);
          results.push({ user: user.email, status: 'success' });
        }
        
        // Add a small delay between deletions
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error: any) {
        console.error(`Exception deleting ${user.email}:`, error);
        results.push({ user: user.email, status: 'exception', error: error.message });
      }
    }
    
    console.log('Cleanup completed:', results);
    return results;
    
  } catch (error) {
    console.error('Cleanup failed:', error);
    throw error;
  }
}