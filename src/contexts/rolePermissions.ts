import { computeRolePermissions as computeRolePermissionsUtil } from '@/utils/auth';

/**
 * @deprecated Use individual permission functions from @/utils/auth instead
 * This function is kept for backward compatibility
 */
export function computeRolePermissions(userRole: string | null, userEmail?: string | null) {
  return computeRolePermissionsUtil(userRole, userEmail);
}
