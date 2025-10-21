/**
 * Centralized Authentication & Authorization Utilities
 * 
 * Single source of truth for all role-based checks and permissions.
 * Use these functions throughout the app instead of inline role comparisons.
 */

import { UserRole } from './roleValidation';

// ============================================================================
// ROLE TYPE CHECKS
// ============================================================================

/**
 * Check if user is a full admin
 */
export const isAdmin = (role?: string | null): boolean => {
  return role === 'admin';
};

/**
 * Check if user is a junior admin (jadmin)
 */
export const isJadmin = (role?: string | null): boolean => {
  return role === 'jadmin';
};

/**
 * Check if user is a prompter
 */
export const isPrompter = (role?: string | null): boolean => {
  return role === 'prompter';
};

/**
 * Check if user is a regular user (not admin/prompter)
 */
export const isRegularUser = (role?: string | null): boolean => {
  return role === 'user';
};

// ============================================================================
// COMBINED ROLE CHECKS
// ============================================================================

/**
 * Check if user has any level of admin access (admin or jadmin)
 */
export const isAnyAdmin = (role?: string | null): boolean => {
  return isAdmin(role) || isJadmin(role);
};

/**
 * Check if user is privileged (admin, jadmin, or prompter)
 * These users bypass subscription checks
 */
export const isPrivilegedUser = (role?: string | null): boolean => {
  return isAdmin(role) || isJadmin(role) || isPrompter(role);
};

/**
 * Check if user is admin or prompter (can manage prompts)
 */
export const isAdminOrPrompter = (role?: string | null): boolean => {
  return isAdmin(role) || isPrompter(role);
};

// ============================================================================
// PERMISSION CHECKS
// ============================================================================

/**
 * Check if user can manage prompts (create, edit, delete)
 */
export const canManagePrompts = (role?: string | null): boolean => {
  return isAdmin(role) || isJadmin(role) || isPrompter(role);
};

/**
 * Check if user can access admin dashboard
 */
export const canAccessAdminDashboard = (role?: string | null): boolean => {
  return isAnyAdmin(role);
};

/**
 * Check if user can manage users (view, create, update user records)
 */
export const canManageUsers = (role?: string | null): boolean => {
  return isAdmin(role);
};

/**
 * Check if user can delete users
 * @param role User role
 * @param email User email (for super admin check)
 */
export const canDeleteUsers = (role?: string | null, email?: string | null): boolean => {
  return isSuperAdmin(role, email);
};

/**
 * Check if user can change passwords
 * @param role User role
 * @param email User email (for super admin check)
 */
export const canChangePasswords = (role?: string | null, email?: string | null): boolean => {
  return isSuperAdmin(role, email);
};

/**
 * Check if user can cancel subscriptions
 * @param role User role
 * @param email User email (for super admin check)
 */
export const canCancelSubscriptions = (role?: string | null, email?: string | null): boolean => {
  return isSuperAdmin(role, email);
};

/**
 * Check if user can access prompt generator tools
 */
export const canAccessPromptGenerator = (role?: string | null): boolean => {
  return isAdmin(role) || isPrompter(role);
};

/**
 * Check if user bypasses subscription requirements
 */
export const bypassesSubscription = (role?: string | null): boolean => {
  return isPrivilegedUser(role);
};

/**
 * Check if user can access sensitive profile data
 */
export const canAccessSensitiveData = (role?: string | null): boolean => {
  return isAdmin(role) || isJadmin(role);
};

/**
 * Check if user can view admin audit logs
 */
export const canViewAuditLogs = (role?: string | null): boolean => {
  return isAdmin(role);
};

// ============================================================================
// SUPER ADMIN CHECKS
// ============================================================================

/**
 * Check if user is super admin (nawaf@elzeer.com with admin role)
 * Super admins have full CRUD permissions including user deletion
 */
export const isSuperAdmin = (role?: string | null, email?: string | null): boolean => {
  return isAdmin(role) && email === 'nawaf@elzeer.com';
};

// ============================================================================
// DATA MASKING PERMISSIONS
// ============================================================================

/**
 * Check if user can view unmasked email addresses
 */
export const canViewUnmaskedEmail = (role?: string | null): boolean => {
  return isAdmin(role) || isJadmin(role);
};

/**
 * Check if user can view unmasked phone numbers
 */
export const canViewUnmaskedPhone = (role?: string | null): boolean => {
  return isAdmin(role);
};

/**
 * Check if user can view IP addresses
 */
export const canViewIpAddresses = (role?: string | null): boolean => {
  return isAdmin(role);
};

/**
 * Check if user can view user agents
 */
export const canViewUserAgents = (role?: string | null): boolean => {
  return isAdmin(role);
};

/**
 * Check if user can view social links
 */
export const canViewSocialLinks = (role?: string | null): boolean => {
  return isAdmin(role) || isJadmin(role);
};

/**
 * Check if user can view bio/profile data
 */
export const canViewProfileData = (role?: string | null): boolean => {
  return isAdmin(role) || isJadmin(role);
};

// ============================================================================
// ROUTE PERMISSIONS
// ============================================================================

/**
 * Get default route for user based on role
 */
export const getDefaultRoute = (role?: string | null): string => {
  if (isAnyAdmin(role)) {
    return '/admin';
  }
  if (isPrompter(role)) {
    return '/dashboard/prompter';
  }
  return '/prompts';
};

/**
 * Check if route requires admin access
 */
export const isAdminRoute = (path: string): boolean => {
  return path.startsWith('/admin');
};

/**
 * Check if route requires subscription
 */
export const requiresSubscription = (path: string, role?: string | null): boolean => {
  // Privileged users bypass subscription checks
  if (bypassesSubscription(role)) {
    return false;
  }
  
  // Premium routes that require subscription
  const premiumRoutes = [
    '/prompts/chatgpt',
    '/prompts/midjourney',
    '/prompts/workflows'
  ];
  
  return premiumRoutes.some(route => path.startsWith(route));
};

// ============================================================================
// COMPUTED PERMISSIONS OBJECT (For backward compatibility)
// ============================================================================

/**
 * Get all permissions for a user
 * @deprecated Use individual permission functions instead
 */
export const computeRolePermissions = (role: string | null, email?: string | null) => {
  return {
    isAdmin: isAdmin(role),
    isJadmin: isJadmin(role),
    isPrompter: isPrompter(role),
    isSuperAdmin: isSuperAdmin(role, email),
    canDeleteUsers: canDeleteUsers(role, email),
    canCancelSubscriptions: canCancelSubscriptions(role, email),
    canManagePrompts: canManagePrompts(role),
    canAccessPromptGenerator: canAccessPromptGenerator(role),
    canChangePasswords: canChangePasswords(role, email),
    canFullCRUD: isSuperAdmin(role, email),
    canManageUsers: canManageUsers(role),
    canAccessSensitiveData: canAccessSensitiveData(role),
    canViewAuditLogs: canViewAuditLogs(role)
  };
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get human-readable role name
 */
export const getRoleDisplayName = (role?: string | null): string => {
  switch (role) {
    case 'admin':
      return 'Administrator';
    case 'jadmin':
      return 'Junior Admin';
    case 'prompter':
      return 'Prompter';
    case 'user':
      return 'User';
    default:
      return 'Unknown';
  }
};

/**
 * Get role badge color class
 */
export const getRoleBadgeColor = (role?: string | null): string => {
  switch (role) {
    case 'admin':
      return 'bg-red-500 text-white';
    case 'jadmin':
      return 'bg-orange-500 text-white';
    case 'prompter':
      return 'bg-blue-500 text-white';
    case 'user':
      return 'bg-gray-500 text-white';
    default:
      return 'bg-gray-300 text-gray-700';
  }
};
