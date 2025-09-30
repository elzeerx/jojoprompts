import { useMemo } from "react";
import { useSuperAdmin } from "./useSuperAdmin";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Centralized permission system for user management
 * Provides granular permissions based on user role
 */
export function useUserPermissions() {
  const { isSuperAdmin } = useSuperAdmin();
  const { isAdmin, isJadmin, canManagePrompts: hasManagePromptsPermission } = useAuth();

  const permissions = useMemo(() => {
    // Super admin has all permissions
    if (isSuperAdmin) {
      return {
        canCreateUsers: true,
        canReadUsers: true,
        canUpdateUsers: true,
        canDeleteUsers: true,
        canChangePasswords: true,
        canManageRoles: true,
        canDeleteAdmins: true,
        canViewSensitiveData: true,
        canBulkOperations: true,
        canImpersonateUsers: false, // Reserved for future implementation
        canAccessAuditLogs: true,
        canManageSubscriptions: true,
        canExportUserData: true,
        // Backward compatibility
        canManagePrompts: hasManagePromptsPermission,
        loading: false
      };
    }

    // Regular admin has limited permissions
    if (isAdmin) {
      return {
        canCreateUsers: true,
        canReadUsers: true,
        canUpdateUsers: true,
        canDeleteUsers: false, // Cannot delete users (only super admin)
        canChangePasswords: false, // Cannot change passwords
        canManageRoles: false, // Cannot change roles
        canDeleteAdmins: false,
        canViewSensitiveData: true,
        canBulkOperations: false,
        canImpersonateUsers: false,
        canAccessAuditLogs: true,
        canManageSubscriptions: false,
        canExportUserData: true,
        // Backward compatibility
        canManagePrompts: hasManagePromptsPermission,
        loading: false
      };
    }

    // Junior admin (jadmin) has read-only permissions
    if (isJadmin) {
      return {
        canCreateUsers: false,
        canReadUsers: true,
        canUpdateUsers: false,
        canDeleteUsers: false,
        canChangePasswords: false,
        canManageRoles: false,
        canDeleteAdmins: false,
        canViewSensitiveData: false,
        canBulkOperations: false,
        canImpersonateUsers: false,
        canAccessAuditLogs: true,
        canManageSubscriptions: false,
        canExportUserData: false,
        // Backward compatibility
        canManagePrompts: hasManagePromptsPermission,
        loading: false
      };
    }

    // No permissions for regular users
    return {
      canCreateUsers: false,
      canReadUsers: false,
      canUpdateUsers: false,
      canDeleteUsers: false,
      canChangePasswords: false,
      canManageRoles: false,
      canDeleteAdmins: false,
      canViewSensitiveData: false,
      canBulkOperations: false,
      canImpersonateUsers: false,
      canAccessAuditLogs: false,
      canManageSubscriptions: false,
      canExportUserData: false,
      // Backward compatibility
      canManagePrompts: hasManagePromptsPermission,
      loading: false
    };
  }, [isSuperAdmin, isAdmin, isJadmin, hasManagePromptsPermission]);

  return permissions;
}
