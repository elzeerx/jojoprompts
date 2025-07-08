
// Centralized role validation utilities

export type UserRole = 'user' | 'prompter' | 'jadmin' | 'admin';

export const VALID_ROLES: UserRole[] = ['user', 'prompter', 'jadmin', 'admin'];

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  user: 'Standard user access',
  prompter: 'Can create and manage prompts',
  jadmin: 'Junior admin - admin access without user/subscription management',
  admin: 'Full system access'
};

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
