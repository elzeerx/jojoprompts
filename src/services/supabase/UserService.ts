/**
 * User service for handling user-related operations
 * Extends BaseService with user-specific functionality
 */

import { BaseService } from './BaseService';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';
import { ApiResponse } from '@/types/common';

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

export interface ProfileUpdateData {
  firstName?: string;
  lastName?: string;
  username?: string;
  avatar_url?: string;
  bio?: string;
}

export interface UserProfile {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  role: 'user' | 'admin' | 'prompter' | 'jadmin';
  avatar_url?: string;
  bio?: string;
  created_at: string;
  updated_at: string;
}

export type UserRole = 'user' | 'admin' | 'prompter' | 'jadmin';

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
          first_name: data.firstName,
          last_name: data.lastName,
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
    return this.findById(userId);
  }

  async getAllUsers(
    page: number = 1, 
    pageSize: number = 20,
    searchTerm?: string
  ): Promise<ApiResponse<UserProfile[]>> {
    const options: any = {
      orderBy: { column: 'created_at', ascending: false }
    };

    if (searchTerm) {
      // For search, we'll use a direct query instead of buildQuery
      return this.executeQuery(
        'getAllUsers',
        () => supabase
          .from('profiles')
          .select('*')
          .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%`)
          .order('created_at', { ascending: false })
          .range((page - 1) * pageSize, page * pageSize - 1),
        { page, pageSize, searchTerm }
      );
    }

    const result = await this.findPaginated(page, pageSize, options);
    if (result.success && result.data) {
      return {
        success: true,
        data: result.data.data
      };
    }
    return result as any;
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
        // Verify admin permissions
        const { data: adminProfile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', adminId)
          .single();

        if (!adminProfile || adminProfile.role !== 'admin') {
          throw new Error('Insufficient permissions to change user roles');
        }

        // Update user role
        const { data, error } = await supabase
          .from('profiles')
          .update({ role: newRole })
          .eq('id', userId)
          .select('*')
          .single();

        if (error) throw error;

        logger.security('Role change completed', { 
          userId, 
          newRole, 
          adminId 
        });

        return { data };
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