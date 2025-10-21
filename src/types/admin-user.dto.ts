/**
 * Unified Data Transfer Object for Admin User Management
 * 
 * This DTO provides a consistent structure for user data across:
 * - Edge function responses (admin-users-v2)
 * - Frontend components
 * - React Query cache
 * 
 * Represents a complete user with profile, role, auth, and subscription data
 */

export type UserRole = 'admin' | 'jadmin' | 'prompter' | 'user';

export interface AdminUserSubscriptionDTO {
  id: string;
  plan_id?: string;
  plan_name: string;
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  is_lifetime: boolean;
  price_usd: number;
  start_date: string;
  end_date?: string | null;
  payment_method?: string;
  duration_days?: number;
  created_at?: string;
}

export interface AdminUserDTO {
  // Core Profile Identity
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  
  // Role (from user_roles table)
  role: UserRole;
  
  // Auth Metadata
  email_confirmed_at: string | null;
  is_email_confirmed?: boolean;
  last_sign_in_at: string | null;
  
  // Profile Metadata
  avatar_url?: string | null;
  bio?: string | null;
  country?: string | null;
  phone_number?: string | null;
  timezone?: string | null;
  social_links?: Record<string, string> | null;
  membership_tier?: string | null;
  
  // Subscription Data
  subscription: AdminUserSubscriptionDTO | null;
  
  // Timestamps
  created_at: string;
  updated_at?: string | null;
  auth_created_at?: string | null;
  auth_updated_at?: string | null;
}

/**
 * Response structure from admin-users-v2 edge function
 */
export interface AdminUsersResponse {
  users: AdminUserDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  performance: {
    duration_ms: number;
    query_count?: number;
    cached?: boolean;
  };
}

/**
 * Request parameters for fetching admin users
 */
export interface AdminUsersRequest {
  page?: number;
  limit?: number;
  search?: string;
}

/**
 * Type guard to check if a value is a valid UserRole
 */
export function isValidUserRole(role: string): role is UserRole {
  return ['admin', 'jadmin', 'prompter', 'user'].includes(role);
}

/**
 * Helper to get role display name
 */
export function getRoleDisplayName(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    admin: 'Administrator',
    jadmin: 'Junior Admin',
    prompter: 'Prompter',
    user: 'User'
  };
  return roleNames[role];
}

/**
 * Helper to get role color for UI
 */
export function getRoleColor(role: UserRole): string {
  const roleColors: Record<UserRole, string> = {
    admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    jadmin: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    prompter: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    user: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  };
  return roleColors[role];
}

/**
 * Helper to get subscription status color for UI
 */
export function getSubscriptionStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    cancelled: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    expired: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    pending: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
  };
  return statusColors[status] || statusColors.pending;
}
