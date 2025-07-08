
/**
 * Utilities for DB operations and logging for get-all-users edge function.
 * Designed to be used from users.ts. No exports here break endpoint behavior.
 */

export async function safeDelete(supabase: any, table: string, column: string, value: any) {
  console.log(`Deleting from ${table} where ${column}=${value}`);
  const { error } = await supabase.from(table).delete().eq(column, value);
  if (error) {
    console.error(`Error deleting from ${table} for ${value}:`, error);
    throw new Error(`Error deleting from ${table}: ${error.message}`);
  }
  console.log(`Successfully deleted from ${table} for ${value}`);
}

// Convenience logging
export function logStep(step: string, userId: string) {
  console.log(`[deleteUser] ${step} for user ${userId}`);
}
