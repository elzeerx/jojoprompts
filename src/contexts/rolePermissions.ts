
export function computeRolePermissions(userRole: string | null) {
  const isAdmin = userRole === 'admin';
  const isJadmin = userRole === 'jadmin';
  const isPrompter = userRole === 'prompter';
  const canDeleteUsers = isAdmin;
  const canCancelSubscriptions = isAdmin;
  const canManagePrompts = isAdmin || isJadmin || isPrompter;
  return {
    isAdmin,
    isJadmin,
    isPrompter,
    canDeleteUsers,
    canCancelSubscriptions,
    canManagePrompts
  };
}
