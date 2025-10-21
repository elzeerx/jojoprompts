/**
 * User service for handling user-related operations
 * Extends BaseService with user-specific functionality
 */

import { BaseService } from './BaseService';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';
interface ApiResponse<T = any> { data?: T; error?: any; success: boolean; }

// User-related type interfaces
export interface AuthCredentials {
  email: string;
  password: string;
}

export interface SignUpData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

import { UserProfile, ProfileUpdateData, ExtendedUserProfile, CreateUserData, UserRole } from "@/types/user";

export type { UserProfile, ProfileUpdateData, ExtendedUserProfile, CreateUserData, UserRole };



export class UserService extends BaseService<UserProfile> {
  constructor() {
    super('profiles', 'UserService');
  }

  // Authentication-related methods
  async signUp(data: SignUpData): Promise<ApiResponse<any>> {
    return this.executeQuery(
      'signUp',
      async () => {
        const { data: authData, error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            data: {
              first_name: data.firstName,
              last_name: data.lastName
            }
          }
        });

        if (error) throw error;
        return { data: authData };
      },
      { email: data.email }
    );
  }

  async signIn(credentials: AuthCredentials): Promise<ApiResponse<any>> {
    return this.executeQuery(
      'signIn',
      async () => {
        const { data, error } = await supabase.auth.signInWithPassword(credentials);
        if (error) throw error;
        return { data };
      },
      { email: credentials.email }
    );
  }

  async signOut(): Promise<ApiResponse<void>> {
    return this.executeQuery(
      'signOut',
      async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        return { data: undefined };
      }
    );
  }

  async getCurrentUser(): Promise<ApiResponse<UserProfile>> {
    return this.executeQuery(
      'getCurrentUser',
      async () => {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) throw new Error('No authenticated user');

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;
        return { data: profile };
      }
    );
  }

  // Profile management
  async updateProfile(userId: string, data: ProfileUpdateData): Promise<ApiResponse<UserProfile>> {
    return this.executeQuery(
      'updateProfile',
      () => supabase
        .from('profiles')
        .update({
          first_name: data.first_name,
          last_name: data.last_name,
          username: data.username,
          avatar_url: data.avatar_url,
          bio: data.bio,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select('*')
        .single(),
      { userId, data }
    );
  }

  async getUserProfile(userId: string): Promise<ApiResponse<UserProfile>> {
    return this.executeQuery(
      'getUserProfile',
      async () => {
        // Use the enhanced secure function with strict access controls and audit logging
        // Names and sensitive data are masked unless user has proper access
        const { data, error } = await supabase.rpc('get_user_profile_safe', {
          user_id_param: userId
        });

        if (error) throw error;
        
        // Convert RPC result to expected format
        if (data && data.length > 0) {
          const profile = data[0];
          return { 
            data: {
              id: profile.id,
              first_name: profile.first_name, // Masked as '***' if no access
              last_name: profile.last_name,   // Masked as '***' if no access
              username: profile.username,
              role: profile.role,
              avatar_url: profile.avatar_url,
              bio: profile.bio,
              country: profile.country,
              membership_tier: profile.membership_tier,
              created_at: profile.created_at,
              // These fields will be null if user doesn't have access to sensitive data
              phone_number: profile.phone_number,
              social_links: profile.social_links,
              updated_at: new Date().toISOString() // Default since not returned by RPC
            }
          };
        }
        
        throw new Error('User profile not found or access denied');
      },
      { userId }
    );
  }

  /**
   * Get minimal public profile information only (enhanced security)
   * For use cases where only basic profile info is needed without exposing personal data
   */
  async getPublicProfile(userId: string): Promise<ApiResponse<Partial<UserProfile>>> {
    return this.executeQuery(
      'getPublicProfile',
      async () => {
        const { data, error } = await supabase.rpc('get_public_profile_safe', {
          user_id_param: userId
        });

        if (error) throw error;
        
        if (data && data.length > 0) {
          const profile = data[0];
          return { 
            data: {
              id: profile.id,
              username: profile.username,
              role: profile.role,
              avatar_url: profile.avatar_url,
              bio: profile.bio,
              created_at: profile.created_at
            }
          };
        }
        
        throw new Error('Public profile not found');
      },
      { userId }
    );
  }

  async getAllUsers(
    page: number = 1, 
    pageSize: number = 20,
    searchTerm?: string
  ): Promise<ApiResponse<UserProfile[]>> {
    return this.executeQuery(
      'getAllUsers',
      async () => {
        // Use secure query with proper admin verification
        let query = supabase
          .from('profiles')
          .select('id, first_name, last_name, username, role, avatar_url, bio, country, membership_tier, created_at')
          .order('created_at', { ascending: false })
          .range((page - 1) * pageSize, page * pageSize - 1);

        if (searchTerm) {
          query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%`);
        }

        const { data, error } = await query;
        
        if (error) throw error;
        
        // Map to include updated_at field
        const profiles = data?.map(profile => ({
          ...profile,
          updated_at: new Date().toISOString() // Default since not queried for performance
        })) || [];
        
        return { data: profiles };
      },
      { page, pageSize, searchTerm }
    );
  }

  async searchUsers(searchTerm: string, limit = 10): Promise<ApiResponse<UserProfile[]>> {
    return this.executeQuery(
      'searchUsers',
      () => supabase
        .from('profiles')
        .select('*')
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%`)
        .limit(limit),
      { searchTerm, limit }
    );
  }

  async updateUserRole(userId: string, newRole: UserRole, adminId: string): Promise<ApiResponse<UserProfile>> {
    logger.security('Attempting role change', { 
      userId, 
      newRole, 
      adminId 
    });

    return this.executeQuery(
      'updateUserRole',
      async () => {
        // Use enhanced admin verification which includes audit logging
        const { data: isVerifiedAdmin, error: verifyError } = await supabase.rpc('is_verified_admin', {
          action_context: 'role_change_request'
        });

        if (verifyError || !isVerifiedAdmin) {
          throw new Error('Admin verification failed - insufficient permissions to change user roles');
        }

        // Update user role - this will use the new secure RLS policies
        const { data, error } = await supabase
          .from('profiles')
          .update({ role: newRole })
          .eq('id', userId)
          .select('id, first_name, last_name, username, role, avatar_url, bio, country, membership_tier, created_at')
          .single();

        if (error) throw error;

        logger.security('Role change completed', { 
          userId, 
          newRole, 
          adminId 
        });

        // Add updated_at field
        const profile = {
          ...data,
          updated_at: new Date().toISOString()
        };

        return { data: profile };
      },
      { userId, newRole, adminId }
    );
  }

  async deleteUserAccount(userId: string, adminId?: string): Promise<ApiResponse<void>> {
    return this.executeQuery(
      'deleteUserAccount',
      async () => {
        const { data, error } = await supabase.rpc('delete_user_account', {
          _user_id: userId
        });

        if (error) throw error;
        
        const result = data as any;
        if (!result.success) throw new Error(result.error || 'Failed to delete account');

        logger.security('User account deleted', { 
          userId, 
          adminId,
          subscriptionCancelled: result.subscription_cancelled 
        });

        return { data: undefined };
      },
      { userId, adminId }
    );
  }

  // Password management
  async resetPassword(email: string): Promise<ApiResponse<void>> {
    return this.executeQuery(
      'resetPassword',
      async () => {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        return { data: undefined };
      },
      { email }
    );
  }

  async updatePassword(newPassword: string): Promise<ApiResponse<void>> {
    return this.executeQuery(
      'updatePassword',
      async () => {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        return { data: undefined };
      }
    );
  }

  // Permission helpers
  async hasRole(userId: string, role: UserRole): Promise<boolean> {
    try {
      const result = await this.callFunction('has_role', { _user_id: userId, _role: role });
      return result.success && result.data === true;
    } catch (error) {
      logger.error('Failed to check user role', this.serviceName, { userId, role, error });
      return false;
    }
  }

  async canManagePrompts(userId: string): Promise<boolean> {
    try {
      const result = await this.callFunction('can_manage_prompts', { _user_id: userId });
      return result.success && result.data === true;
    } catch (error) {
      logger.error('Failed to check prompt management permissions', this.serviceName, { userId, error });
      return false;
    }
  }

  // User statistics
  async getUserStats(): Promise<ApiResponse<any>> {
    return this.executeQuery(
      'getUserStats',
      async () => {
        // Verify admin access for statistics with logging
        const { data: isVerifiedAdmin, error: verifyError } = await supabase.rpc('is_verified_admin', {
          action_context: 'user_statistics_access'
        });

        if (verifyError || !isVerifiedAdmin) {
          throw new Error('Admin verification failed - insufficient permissions to access user statistics');
        }

        const { data: users } = await supabase
          .from('profiles')
          .select('role, created_at');

        const usersByRole = users?.reduce((acc, user) => {
          acc[user.role] = (acc[user.role] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {};

        const recentUsers = users?.filter(user => 
          new Date(user.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        ).length || 0;

        return {
          data: {
            totalUsers: users?.length || 0,
            usersByRole,
            recentUsers
          }
        };
      }
    );
  }
}

// Export singleton instance
export const userService = new UserService();