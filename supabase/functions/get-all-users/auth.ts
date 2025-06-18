
// Re-export all functionality from the modular auth system
export { verifyAdmin } from './auth/adminVerifier.ts';
export { validateAdminRequest } from './auth/requestValidator.ts';
export { hasPermission } from './auth/permissionManager.ts';
export type { AuthContext } from './auth/types.ts';
