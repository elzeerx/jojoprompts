// User Management Hooks - Consolidated exports
// Phase 6: Cleaned up and consolidated hook architecture

// Main management hook (combines all functionality)
export { useUserManagement } from './useUserManagement';

// Core service hooks
export { useUserService } from './useUserService';
export { useUserList } from './useUserList';
export { useUserBulkActions } from './useUserBulkActions';

// Utility hooks
export { useUserActions } from './useUserActions';
export { useAdminErrorHandler } from './useAdminErrorHandler';

// Types
export type { UserFilters } from './useUserList';
