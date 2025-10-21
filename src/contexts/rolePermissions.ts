
export function computeRolePermissions(userRole: string | null, userEmail?: string | null) {
  const isAdmin = userRole === 'admin';
  const isJadmin = userRole === 'jadmin';
  const isPrompter = userRole === 'prompter';
  
  // Super admin access - only for nawaf@elzeer.com
  const isSuperAdmin = userEmail === 'nawaf@elzeer.com' && isAdmin;
  
  const canDeleteUsers = isSuperAdmin;
  const canCancelSubscriptions = isSuperAdmin;
  const canManagePrompts = isAdmin || isJadmin || isPrompter;
  const canAccessPromptGenerator = isAdmin || isPrompter;
  const canChangePasswords = isSuperAdmin;
  const canFullCRUD = isSuperAdmin;
  
  return {
    isAdmin,
    isJadmin,
    isPrompter,
    isSuperAdmin,
    canDeleteUsers,
    canCancelSubscriptions,
    canManagePrompts,
    canAccessPromptGenerator,
    canChangePasswords,
    canFullCRUD
  };
}
