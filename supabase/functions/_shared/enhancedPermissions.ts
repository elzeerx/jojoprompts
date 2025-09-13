// Enhanced permission system with granular controls
export interface PermissionGroup {
  name: string;
  permissions: string[];
  description: string;
}

export interface SecurityLevel {
  level: number;
  name: string;
  description: string;
  required_permissions: string[];
}

// Granular permission definitions
export const PERMISSION_GROUPS: Record<string, PermissionGroup> = {
  USER_MANAGEMENT: {
    name: 'User Management',
    permissions: [
      'user:read',
      'user:write', 
      'user:delete',
      'user:create',
      'user:password:change',
      'user:role:change',
      'user:status:change',
      'user:profile:sensitive'
    ],
    description: 'Full user account management capabilities'
  },
  BULK_OPERATIONS: {
    name: 'Bulk Operations',
    permissions: [
      'bulk:user:delete',
      'bulk:user:update',
      'bulk:role:change',
      'bulk:export',
      'bulk:import'
    ],
    description: 'Mass operations on multiple users'
  },
  SUBSCRIPTION_MANAGEMENT: {
    name: 'Subscription Management', 
    permissions: [
      'subscription:read',
      'subscription:write',
      'subscription:cancel',
      'subscription:refund',
      'subscription:upgrade',
      'subscription:downgrade'
    ],
    description: 'Subscription and billing management'
  },
  FINANCIAL_OPERATIONS: {
    name: 'Financial Operations',
    permissions: [
      'transaction:read',
      'transaction:write',
      'transaction:refund',
      'payment:process',
      'revenue:analytics'
    ],
    description: 'Financial transactions and revenue management'
  },
  SYSTEM_ADMINISTRATION: {
    name: 'System Administration',
    permissions: [
      'system:audit',
      'system:config',
      'system:admin',
      'system:security',
      'system:backup',
      'system:maintenance'
    ],
    description: 'Core system administration and security'
  },
  SECURITY_MANAGEMENT: {
    name: 'Security Management',
    permissions: [
      'security:audit:read',
      'security:logs:read',
      'security:whitelist:manage',
      'security:rate:manage',
      'security:session:manage',
      'security:threat:respond'
    ],
    description: 'Security monitoring and incident response'
  },
  CONTENT_MANAGEMENT: {
    name: 'Content Management',
    permissions: [
      'prompt:read',
      'prompt:write',
      'prompt:delete',
      'prompt:publish',
      'category:manage',
      'content:moderate'
    ],
    description: 'Content creation and moderation'
  }
};

// Security levels for different admin roles
export const SECURITY_LEVELS: Record<string, SecurityLevel> = {
  SUPER_ADMIN: {
    level: 5,
    name: 'Super Administrator',
    description: 'Unrestricted access to all system functions',
    required_permissions: Object.values(PERMISSION_GROUPS).flatMap(group => group.permissions)
  },
  ADMIN: {
    level: 4,
    name: 'Administrator',
    description: 'Full administrative access except super admin functions',
    required_permissions: [
      ...PERMISSION_GROUPS.USER_MANAGEMENT.permissions,
      ...PERMISSION_GROUPS.BULK_OPERATIONS.permissions,
      ...PERMISSION_GROUPS.SUBSCRIPTION_MANAGEMENT.permissions,
      ...PERMISSION_GROUPS.FINANCIAL_OPERATIONS.permissions,
      ...PERMISSION_GROUPS.CONTENT_MANAGEMENT.permissions,
      'system:audit', 'system:config',
      'security:audit:read', 'security:logs:read'
    ]
  },
  JADMIN: {
    level: 3,
    name: 'Junior Administrator',
    description: 'Limited administrative access for junior staff',
    required_permissions: [
      'user:read', 'user:write', 'user:profile:sensitive',
      'subscription:read', 'subscription:write',
      'transaction:read',
      'prompt:read', 'prompt:write',
      'security:audit:read'
    ]
  },
  MODERATOR: {
    level: 2,
    name: 'Content Moderator',
    description: 'Content management and basic user operations',
    required_permissions: [
      'user:read',
      'prompt:read', 'prompt:write', 'prompt:delete',
      'content:moderate',
      'security:audit:read'
    ]
  },
  SUPPORT: {
    level: 1,
    name: 'Support Agent',
    description: 'Read-only access for customer support',
    required_permissions: [
      'user:read',
      'subscription:read',
      'transaction:read',
      'prompt:read'
    ]
  }
};

// Generate role-based permissions with enhanced granularity
export function generatePermissions(role: string, customPermissions?: string[]): string[] {
  const permissions: string[] = [];

  // Get base permissions for role
  switch (role) {
    case 'admin':
      permissions.push(...SECURITY_LEVELS.ADMIN.required_permissions);
      break;
    case 'jadmin':
      permissions.push(...SECURITY_LEVELS.JADMIN.required_permissions);
      break;
    case 'moderator':
      permissions.push(...SECURITY_LEVELS.MODERATOR.required_permissions);
      break;
    case 'support':
      permissions.push(...SECURITY_LEVELS.SUPPORT.required_permissions);
      break;
    case 'prompter':
      permissions.push(
        'user:read',
        'prompt:read', 'prompt:write', 'prompt:publish',
        'category:manage'
      );
      break;
  }

  // Add custom permissions if provided
  if (customPermissions) {
    permissions.push(...customPermissions.filter(p => !permissions.includes(p)));
  }

  // Remove duplicates and return
  return [...new Set(permissions)];
}

// Enhanced permission checking with hierarchy support
export function hasPermission(permissions: string[], requiredPermission: string): boolean {
  // Direct permission check
  if (permissions.includes(requiredPermission)) {
    return true;
  }

  // Check for wildcard permissions
  const [domain, action] = requiredPermission.split(':');
  const wildcardPermission = `${domain}:*`;
  if (permissions.includes(wildcardPermission)) {
    return true;
  }

  // Check for super admin permission
  if (permissions.includes('system:admin') || permissions.includes('*:*')) {
    return true;
  }

  return false;
}

// Check multiple permissions with AND/OR logic
export function hasAllPermissions(permissions: string[], requiredPermissions: string[]): boolean {
  return requiredPermissions.every(perm => hasPermission(permissions, perm));
}

export function hasAnyPermission(permissions: string[], requiredPermissions: string[]): boolean {
  return requiredPermissions.some(perm => hasPermission(permissions, perm));
}

// Get security level for user
export function getUserSecurityLevel(role: string): SecurityLevel | null {
  switch (role) {
    case 'admin':
      return SECURITY_LEVELS.ADMIN;
    case 'jadmin':
      return SECURITY_LEVELS.JADMIN;
    case 'moderator':
      return SECURITY_LEVELS.MODERATOR;
    case 'support':
      return SECURITY_LEVELS.SUPPORT;
    default:
      return null;
  }
}

// Check if user can perform action based on security level
export function canPerformAction(userRole: string, requiredLevel: number): boolean {
  const userLevel = getUserSecurityLevel(userRole);
  return userLevel ? userLevel.level >= requiredLevel : false;
}