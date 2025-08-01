/**
 * User service for authentication and profile management
 */

import { BaseService } from './BaseService';
import { supabase } from '@/integrations/supabase/client';
import { User, UserProfile, UserRole, ApiResponse } from '@/types/common';
import { logger } from '@/utils/logger';

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface SignUpData extends AuthCredentials {
  firstName?: string;
  lastName?: string;
}

export interface ProfileUpdateData {
  first_name?: string;
  last_name?: string;
  bio?: string;
  avatar_url?: string;
  phone_number?: string;
  country?: string;
  timezone?: string;
  social_links?: Record<string, string>;
}

class UserService extends BaseService<UserProfile> {
  constructor() {
    super('profiles', 'UserService');
  }

  // Authentication methods
  async signUp(data: SignUpData): Promise<ApiResponse<User>> {
    return this.executeQuery(
      'signUp',
      async () => {
        const { data: authData, error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            data: {
              first_name: data.firstName,
              last_name: data.lastName,
              full_name: `${data.firstName || ''} ${data.lastName || ''}`.trim()
            }
          }
        });

        if (error) throw error;
        return { data: authData.user };
      },
      { email: data.email }
    );
  }

  async signIn(credentials: AuthCredentials): Promise<ApiResponse<User>> {
    return this.executeQuery(
      'signIn',
      async () => {
        const { data, error } = await supabase.auth.signInWithPassword(credentials);
        if (error) throw error;
        return { data: data.user };
      },
      { email: credentials.email }
    );
  }

  async signInWithMagicLink(email: string): Promise<ApiResponse<void>> {
    return this.executeQuery(
      'signInWithMagicLink',
      async () => {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/email-confirmation`
          }
        });
        if (error) throw error;
        return { data: undefined };
      },
      { email }
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

  async resetPassword(email: string): Promise<ApiResponse<void>> {
    return this.executeQuery(
      'resetPassword',
      async () => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`
        });
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
        const { error } = await supabase.auth.updateUser({
          password: newPassword
        });
        if (error) throw error;
        return { data: undefined };
      }
    );
  }

  // Profile methods
  async getProfile(userId: string): Promise<ApiResponse<UserProfile>> {
    return this.findById(userId);
  }

  async updateProfile(userId: string, data: ProfileUpdateData): Promise<ApiResponse<UserProfile>> {
    return this.update(userId, data);
  }

  async getUserWithProfile(userId: string): Promise<ApiResponse<{ user: User; profile: UserProfile }>> {
    return this.executeQuery(
      'getUserWithProfile',
      async () => {
        // Get auth user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error('User not found');

        // Get profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (profileError) throw profileError;

        return { data: { user, profile } };
      },
      { userId }
    );
  }

  async getUsersByRole(role: UserRole): Promise<ApiResponse<UserProfile[]>> {
    return this.findAll({
      filters: { role },
      orderBy: { column: 'created_at', ascending: false }
    });
  }

  async searchUsers(searchTerm: string, limit: number = 20): Promise<ApiResponse<UserProfile[]>> {
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
    logger.security('Attempting role change', this.serviceName, { 
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

        logger.security('Role change completed', this.serviceName, { 
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
        if (!data.success) throw new Error(data.error || 'Failed to delete account');

        logger.security('User account deleted', this.serviceName, { 
          userId, 
          adminId,
          subscriptionCancelled: data.subscription_cancelled 
        });

        return { data: undefined };
      },
      { userId, adminId }
    );
  }

  // Session and security methods
  async getCurrentSession(): Promise<ApiResponse<any>> {
    return this.executeQuery(
      'getCurrentSession',
      async () => {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        return { data: data.session };
      }
    );
  }

  async refreshSession(): Promise<ApiResponse<any>> {
    return this.executeQuery(
      'refreshSession',
      async () => {
        const { data, error } = await supabase.auth.refreshSession();
        if (error) throw error;
        return { data: data.session };
      }
    );
  }

  // Admin methods
  async getAllUsers(options: { page?: number; pageSize?: number; role?: UserRole } = {}): Promise<ApiResponse<any>> {
    const { page = 1, pageSize = 20, role } = options;
    
    const queryOptions = {
      orderBy: { column: 'created_at', ascending: false },
      ...(role && { filters: { role } })
    };

    return this.findPaginated(page, pageSize, queryOptions);
  }

  async getUserStats(): Promise<ApiResponse<Record<string, number>>> {
    return this.executeQuery(
      'getUserStats',
      async () => {
        const [
          { count: totalUsers },
          { count: adminUsers },
          { count: prompterUsers },
          { count: activeUsers }
        ] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'prompter'),
          supabase.from('profiles').select('*', { count: 'exact', head: true })
            .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        ]);

        return {
          data: {
            total: totalUsers || 0,
            admins: adminUsers || 0,
            prompters: prompterUsers || 0,
            activeLastMonth: activeUsers || 0
          }
        };
      }
    );
  }
}

export const userService = new UserService();