import { createEdgeLogger } from '../_shared/logger.ts';

const logger = createEdgeLogger('get-all-users:db-utils');

/**
 * Utilities for DB operations and logging for get-all-users edge function.
 * Designed to be used from users.ts. No exports here break endpoint behavior.
 */

export async function safeDelete(supabase: any, table: string, column: string, value: any) {
  logger.info('Deleting from table', { table, column, value });
  const { error } = await supabase.from(table).delete().eq(column, value);
  if (error) {
    logger.error('Error deleting from table', { table, value, error });
    throw new Error(`Error deleting from ${table}: ${error.message}`);
  }
  logger.info('Successfully deleted from table', { table, value });
}

// Convenience logging
export function logStep(step: string, userId: string) {
  logger.info('Delete user step', { step, userId });
}
