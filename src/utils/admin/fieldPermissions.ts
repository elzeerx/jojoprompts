import { UserRole } from "@/types/user";

// Define field-level permissions for different admin roles
export interface FieldPermission {
  view: boolean;
  edit: boolean;
  superAdminOnly?: boolean;
}

export interface FieldPermissions {
  [fieldName: string]: FieldPermission;
}

// Field permissions configuration
export const FIELD_PERMISSIONS: Record<UserRole, FieldPermissions> = {
  admin: {
    first_name: { view: true, edit: true },
    last_name: { view: true, edit: true },
    username: { view: true, edit: true },
    email: { view: true, edit: true },
    role: { view: true, edit: true },
    bio: { view: true, edit: true },
    avatar_url: { view: true, edit: true },
    country: { view: true, edit: true },
    phone_number: { view: true, edit: true },
    timezone: { view: true, edit: true },
    membership_tier: { view: true, edit: true },
    social_links: { view: true, edit: true },
    account_status: { view: true, edit: true },
    email_confirmed: { view: true, edit: true },
    created_at: { view: true, edit: false },
    last_sign_in_at: { view: true, edit: false },
    updated_at: { view: true, edit: false },
    // Sensitive admin-only fields
    security_logs: { view: true, edit: false, superAdminOnly: true },
    audit_logs: { view: true, edit: false, superAdminOnly: true },
    ip_address: { view: true, edit: false, superAdminOnly: true },
    user_agent: { view: true, edit: false, superAdminOnly: true }
  },
  jadmin: {
    first_name: { view: true, edit: true },
    last_name: { view: true, edit: true },
    username: { view: true, edit: true },
    email: { view: true, edit: false }, // Junior admins can view but not edit email
    role: { view: true, edit: false }, // Cannot change roles
    bio: { view: true, edit: true },
    avatar_url: { view: true, edit: true },
    country: { view: true, edit: true },
    phone_number: { view: true, edit: true },
    timezone: { view: true, edit: true },
    membership_tier: { view: true, edit: false }, // Cannot change membership tiers
    social_links: { view: true, edit: true },
    account_status: { view: true, edit: false }, // Cannot disable/enable accounts
    email_confirmed: { view: true, edit: false },
    created_at: { view: true, edit: false },
    last_sign_in_at: { view: true, edit: false },
    updated_at: { view: true, edit: false },
    // Restricted access to sensitive fields
    security_logs: { view: false, edit: false },
    audit_logs: { view: false, edit: false },
    ip_address: { view: false, edit: false },
    user_agent: { view: false, edit: false }
  },
  prompter: {
    first_name: { view: true, edit: false },
    last_name: { view: true, edit: false },
    username: { view: true, edit: false },
    email: { view: true, edit: false },
    role: { view: true, edit: false },
    bio: { view: true, edit: false },
    avatar_url: { view: true, edit: false },
    country: { view: true, edit: false },
    phone_number: { view: false, edit: false }, // No access to contact info
    timezone: { view: true, edit: false },
    membership_tier: { view: true, edit: false },
    social_links: { view: false, edit: false }, // No access to social links
    account_status: { view: false, edit: false },
    email_confirmed: { view: true, edit: false },
    created_at: { view: true, edit: false },
    last_sign_in_at: { view: false, edit: false },
    updated_at: { view: true, edit: false },
    // No access to sensitive fields
    security_logs: { view: false, edit: false },
    audit_logs: { view: false, edit: false },
    ip_address: { view: false, edit: false },
    user_agent: { view: false, edit: false }
  },
  user: {
    // Regular users have no admin access
    first_name: { view: false, edit: false },
    last_name: { view: false, edit: false },
    username: { view: false, edit: false },
    email: { view: false, edit: false },
    role: { view: false, edit: false },
    bio: { view: false, edit: false },
    avatar_url: { view: false, edit: false },
    country: { view: false, edit: false },
    phone_number: { view: false, edit: false },
    timezone: { view: false, edit: false },
    membership_tier: { view: false, edit: false },
    social_links: { view: false, edit: false },
    account_status: { view: false, edit: false },
    email_confirmed: { view: false, edit: false },
    created_at: { view: false, edit: false },
    last_sign_in_at: { view: false, edit: false },
    updated_at: { view: false, edit: false },
    security_logs: { view: false, edit: false },
    audit_logs: { view: false, edit: false },
    ip_address: { view: false, edit: false },
    user_agent: { view: false, edit: false }
  }
};

// Helper functions for checking permissions
export function canViewField(userRole: UserRole, fieldName: string, isSuperAdmin: boolean = false): boolean {
  const permission = FIELD_PERMISSIONS[userRole]?.[fieldName];
  if (!permission) return false;
  
  if (permission.superAdminOnly && !isSuperAdmin) {
    return false;
  }
  
  return permission.view;
}

export function canEditField(userRole: UserRole, fieldName: string, isSuperAdmin: boolean = false): boolean {
  const permission = FIELD_PERMISSIONS[userRole]?.[fieldName];
  if (!permission) return false;
  
  if (permission.superAdminOnly && !isSuperAdmin) {
    return false;
  }
  
  return permission.edit;
}

export function getVisibleFields(userRole: UserRole, isSuperAdmin: boolean = false): string[] {
  const permissions = FIELD_PERMISSIONS[userRole];
  if (!permissions) return [];
  
  return Object.keys(permissions).filter(fieldName => 
    canViewField(userRole, fieldName, isSuperAdmin)
  );
}

export function getEditableFields(userRole: UserRole, isSuperAdmin: boolean = false): string[] {
  const permissions = FIELD_PERMISSIONS[userRole];
  if (!permissions) return [];
  
  return Object.keys(permissions).filter(fieldName => 
    canEditField(userRole, fieldName, isSuperAdmin)
  );
}

// Check if user is a super admin (highest level admin)
export function isSuperAdmin(userRole: UserRole, userId?: string): boolean {
  // For now, all full admins are considered super admins
  // This could be extended to check specific user IDs or additional metadata
  return userRole === 'admin';
}