/**
 * Unified Role Management System
 * 
 * This module consolidates role definitions, permissions, and validation
 * into a single source of truth for the application.
 */

// ===== ROLE DEFINITIONS =====

export type UserRole = 'user' | 'prompter' | 'jadmin' | 'admin';

export const USER_ROLES = {
  USER: 'user' as const,
  PROMPTER: 'prompter' as const,
  JADMIN: 'jadmin' as const,
  ADMIN: 'admin' as const,
} as const;

export const VALID_ROLES: UserRole[] = ['user', 'prompter', 'jadmin', 'admin'];

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  user: 'Standard user access with basic features',
  prompter: 'Can create, edit, and manage prompts',
  jadmin: 'Junior admin - admin access without user/subscription management',
  admin: 'Full system access including user and subscription management'
};

// ===== ROLE HIERARCHY =====

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 1,
  prompter: 2,
  jadmin: 3,
  admin: 4,
};

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  user: [
    'prompts:view',
    'profile:edit',
    'favorites:manage',
    'collections:manage',
  ],
  prompter: [
    'prompts:view',
    'prompts:create',
    'prompts:edit',
    'prompts:delete',
    'profile:edit',
    'favorites:manage',
    'collections:manage',
    'prompt-generator:access',
  ],
  jadmin: [
    'prompts:view',
    'prompts:create', 
    'prompts:edit',
    'prompts:delete',
    'prompts:manage-all',
    'profile:edit',
    'favorites:manage',
    'collections:manage',
    'admin:read',
    'prompt-generator:access',
  ],
  admin: [
    'prompts:view',
    'prompts:create',
    'prompts:edit', 
    'prompts:delete',
    'prompts:manage-all',
    'profile:edit',
    'favorites:manage',
    'collections:manage',
    'admin:read',
    'admin:write',
    'admin:delete',
    'users:manage',
    'users:delete',
    'subscriptions:manage',
    'subscriptions:cancel',
    'prompt-generator:access',
  ],
};

// ===== VALIDATION FUNCTIONS =====

export const isValidRole = (role: string): role is UserRole => {
  return VALID_ROLES.includes(role as UserRole);
};

export const validateRole = (role: string): { isValid: boolean; error?: string } => {
  if (!role) {
    return { isValid: false, error: 'Role is required' };
  }
  
  if (!isValidRole(role)) {
    return { 
      isValid: false, 
      error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` 
    };
  }
  
  return { isValid: true };
};

// ===== PERMISSION CHECKING =====

export const hasPermission = (userRole: UserRole | null, permission: string): boolean => {
  if (!userRole) return false;
  return ROLE_PERMISSIONS[userRole]?.includes(permission) || false;
};

export const hasAnyPermission = (userRole: UserRole | null, permissions: string[]): boolean => {
  if (!userRole || permissions.length === 0) return false;
  return permissions.some(permission => hasPermission(userRole, permission));
};

export const hasAllPermissions = (userRole: UserRole | null, permissions: string[]): boolean => {
  if (!userRole || permissions.length === 0) return false;
  return permissions.every(permission => hasPermission(userRole, permission));
};

// ===== ROLE HIERARCHY CHECKING =====

export const hasRoleLevel = (userRole: UserRole | null, requiredRole: UserRole): boolean => {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
};

export const isRoleEqualOrHigher = (userRole: UserRole | null, targetRole: UserRole): boolean => {
  return hasRoleLevel(userRole, targetRole);
};

// ===== PERMISSION COMPUTATION (Legacy Support) =====

export interface RolePermissions {
  isAdmin: boolean;
  isJadmin: boolean;
  isPrompter: boolean;
  canDeleteUsers: boolean;
  canCancelSubscriptions: boolean;
  canManagePrompts: boolean;
  canAccessPromptGenerator: boolean;
}

export function computeRolePermissions(userRole: string | null): RolePermissions {
  const role = userRole as UserRole;
  
  const isAdmin = role === USER_ROLES.ADMIN;
  const isJadmin = role === USER_ROLES.JADMIN;
  const isPrompter = role === USER_ROLES.PROMPTER;

  return {
    isAdmin,
    isJadmin,
    isPrompter,
    canDeleteUsers: hasPermission(role, 'users:delete'),
    canCancelSubscriptions: hasPermission(role, 'subscriptions:cancel'),
    canManagePrompts: hasPermission(role, 'prompts:manage-all'),
    canAccessPromptGenerator: hasPermission(role, 'prompt-generator:access'),
  };
}

// ===== UTILITY FUNCTIONS =====

export const getRoleDisplayName = (role: UserRole): string => {
  return ROLE_DESCRIPTIONS[role] || 'Unknown Role';
};

export const getRolesByMinimumLevel = (minimumRole: UserRole): UserRole[] => {
  const minimumLevel = ROLE_HIERARCHY[minimumRole];
  return VALID_ROLES.filter(role => ROLE_HIERARCHY[role] >= minimumLevel);
};

export const canRoleAccessFeature = (userRole: UserRole | null, feature: string): boolean => {
  // Map common features to permissions
  const featurePermissionMap: Record<string, string> = {
    admin: 'admin:read',
    'user-management': 'users:manage',
    'subscription-management': 'subscriptions:manage',
    'prompt-management': 'prompts:manage-all',
    'prompt-generator': 'prompt-generator:access',
    dashboard: 'profile:edit', // Basic dashboard access
    favorites: 'favorites:manage',
    collections: 'collections:manage',
  };

  const permission = featurePermissionMap[feature];
  return permission ? hasPermission(userRole, permission) : false;
};

// Module exports are handled by individual export statements above