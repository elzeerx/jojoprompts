
// Generate role-based permissions
export function generatePermissions(role: string): string[] {
  const permissions: string[] = [];

  switch (role) {
    case 'admin':
      permissions.push(
        'user:read', 'user:write', 'user:delete', 'user:password:change', 'user:manage',
        'subscription:read', 'subscription:write', 'subscription:cancel',
        'transaction:read', 'transaction:write',
        'system:audit', 'system:config', 'system:admin'
      );
      break;
    case 'jadmin':
      permissions.push(
        'user:read', 'user:write', 'subscription:read', 'transaction:read'
      );
      break;
  }

  return permissions;
}

// Check if user has specific permission
export function hasPermission(permissions: string[], requiredPermission: string): boolean {
  return permissions.includes(requiredPermission);
}
