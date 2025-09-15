// Unified User Types and Interfaces

// User role enum matching database constraints
export type UserRole = 'user' | 'admin' | 'prompter' | 'jadmin';

// Social links structure
export interface SocialLinks {
  [platform: string]: string;
}

// Complete UserProfile interface matching database schema
export interface UserProfile {
  // Required fields
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  role: UserRole;
  
  // Optional fields (nullable in database)
  created_at?: string | null;
  social_links?: SocialLinks | null;
  phone_number?: string | null;
  timezone?: string | null;
  membership_tier?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  country?: string | null;
}

// Extended user profile with additional metadata for admin views
export interface ExtendedUserProfile extends UserProfile {
  email?: string;
  last_sign_in_at?: string | null;
  updated_at?: string | null;
  is_email_confirmed?: boolean;
}

// User creation data structure
export interface CreateUserData {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  role?: UserRole;
}

// User update data structure (all fields optional for partial updates)
export interface UserUpdateData {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  role?: UserRole;
  email?: string;
  bio?: string | null;
  avatar_url?: string | null;
  country?: string | null;
  phone_number?: string | null;
  social_links?: SocialLinks | null;
  timezone?: string | null;
  membership_tier?: string | null;
}

// Profile update data for user self-service (excludes role and email)
export interface ProfileUpdateData {
  first_name?: string;
  last_name?: string;
  username?: string;
  avatar_url?: string;
  bio?: string;
  country?: string;
  phone_number?: string;
  social_links?: SocialLinks;
  timezone?: string;
}

// User query parameters for listing/filtering
export interface UserQueryParams {
  page?: number;
  pageSize?: number;
  searchTerm?: string;
  role?: UserRole;
  membershipTier?: string;
  sortBy?: 'created_at' | 'first_name' | 'last_name' | 'username';
  sortOrder?: 'asc' | 'desc';
}

// User statistics for admin dashboard
export interface UserStatistics {
  totalUsers: number;
  activeUsers: number;
  usersByRole: Record<UserRole, number>;
  usersByMembershipTier: Record<string, number>;
  recentSignups: number;
}