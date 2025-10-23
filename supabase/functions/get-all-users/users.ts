import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from './cors.ts';
import { safeDelete, logStep } from './dbUtils.ts';
import { deleteUser as deleteUserFn } from './userDeletion.ts';
import { updateUser as updateUserFn } from './userUpdate.ts';
import { createUser as createUserFn } from './userCreate.ts';
import { createEdgeLogger } from '../_shared/logger.ts';

const logger = createEdgeLogger('get-all-users:users');

/**
 * List all users with their profile info.
 */
export async function listUsers(
  supabase: ReturnType<typeof createClient>, 
  adminId: string,
  options: {
    page?: number;
    limit?: number;
    search?: string;
    includeAuth?: boolean;
  } = {}
) {
  logger.info('Admin fetching users', { adminId, options });
  
  const { page = 1, limit = 10, search = '', includeAuth = true } = options;
  
  try {
    let authUsers: any[] = [];
    let totalAuthUsers = 0;
    
    if (includeAuth) {
      // Get auth users with pagination for performance
      const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000 // Get more users in batches for efficient processing
      });

      if (authError) {
        logger.error('Error listing auth users', { error: authError.message });
        throw new Error(`Error fetching auth users: ${authError.message}`);
      }

      authUsers = authData?.users || [];
      totalAuthUsers = authUsers.length;
      
      // If we need more users, fetch additional pages
      if (authUsers.length === 1000) {
        let currentPage = 2;
        let hasMore = true;
        
        while (hasMore && currentPage <= 10) { // Limit to 10 pages for safety
          const { data: moreBatch, error: moreError } = await supabase.auth.admin.listUsers({
            page: currentPage,
            perPage: 1000
          });
          
          if (moreError) break;
          
          const moreBatchUsers = moreBatch?.users || [];
          authUsers.push(...moreBatchUsers);
          totalAuthUsers += moreBatchUsers.length;
          
          hasMore = moreBatchUsers.length === 1000;
          currentPage++;
        }
      }
    }

    // Get comprehensive profile data with all fields
    const profileQuery = supabase
      .from('profiles')
      .select(`
        id,
        first_name,
        last_name,
        username,
        role,
        bio,
        avatar_url,
        country,
        phone_number,
        timezone,
        membership_tier,
        social_links,
        created_at
      `);

    // Apply search filter if provided
    if (search) {
      profileQuery.or(`
        first_name.ilike.%${search}%,
        last_name.ilike.%${search}%,
        username.ilike.%${search}%
      `);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    profileQuery.range(offset, offset + limit - 1);
    
    const { data: profiles, error: profileError, count: totalProfiles } = await profileQuery;

    if (profileError) {
      logger.error('Error fetching profiles', { error: profileError.message });
      throw new Error(`Error fetching profiles: ${profileError.message}`);
    }

    if (!profiles || profiles.length === 0) {
      logger.info('No profiles found', { search, page });
      return {
        users: [], 
        total: 0, 
        totalPages: 0,
        page,
        limit
      };
    }

    // Get user subscriptions for the profiles in this page
    const profileIds = profiles.map(p => p.id);
    const { data: subscriptions, error: subError } = await supabase
      .from('user_subscriptions')
      .select(`
        user_id,
        status,
        start_date,
        end_date,
        payment_method,
        created_at,
        subscription_plans!inner(
          id,
          name,
          price_usd,
          is_lifetime
        )
      `)
      .in('user_id', profileIds)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (subError) {
      logger.warn('Error fetching subscriptions', { error: subError.message });
    }

    // Create subscription map for efficient lookup
    const subscriptionMap = new Map();
    if (subscriptions) {
      subscriptions.forEach(sub => {
        if (!subscriptionMap.has(sub.user_id)) {
          subscriptionMap.set(sub.user_id, sub);
        }
      });
    }

    // Create auth user map for efficient lookup
    const authUserMap = new Map();
    if (includeAuth && authUsers.length > 0) {
      authUsers.forEach(user => {
        authUserMap.set(user.id, user);
      });
    }

    // Combine all data efficiently
    const combinedUsers = profiles.map(profile => {
      const authUser = authUserMap.get(profile.id);
      const subscription = subscriptionMap.get(profile.id);
      
      return {
        // Profile data (complete)
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        username: profile.username,
        role: profile.role || 'user',
        bio: profile.bio,
        avatar_url: profile.avatar_url,
        country: profile.country,
        phone_number: profile.phone_number,
        timezone: profile.timezone,
        membership_tier: profile.membership_tier || 'free',
        social_links: profile.social_links || {},
        created_at: profile.created_at,
        
        // Auth data (when available)
        ...(authUser && {
          email: authUser.email,
          email_confirmed_at: authUser.email_confirmed_at,
          last_sign_in_at: authUser.last_sign_in_at,
          is_email_confirmed: !!authUser.email_confirmed_at,
          auth_created_at: authUser.created_at,
          auth_updated_at: authUser.updated_at
        }),
        
        // Subscription data (when available)
        subscription: subscription ? {
          plan_id: subscription.subscription_plans.id,
          plan_name: subscription.subscription_plans.name,
          price_usd: subscription.subscription_plans.price_usd,
          is_lifetime: subscription.subscription_plans.is_lifetime,
          status: subscription.status,
          start_date: subscription.start_date,
          end_date: subscription.end_date,
          payment_method: subscription.payment_method,
          subscription_created_at: subscription.created_at
        } : null
      };
    });

    const totalPages = Math.ceil((totalProfiles || 0) / limit);

    logger.info('Successfully fetched users', { 
      count: combinedUsers.length, 
      page, 
      totalPages,
      totalProfiles 
    });
    
    return {
      users: combinedUsers,
      total: totalProfiles || 0,
      totalPages,
      page,
      limit,
      totalAuthUsers: includeAuth ? totalAuthUsers : undefined
    };
  } catch (error) {
    logger.error('Error in listUsers', { error });
    throw error;
  }
}

/**
 * Delete user and associated data.
 */
export const deleteUser = deleteUserFn;

/**
 * Update user details and profile.
 */
export const updateUser = updateUserFn;

/**
 * Create a new user and associated profile.
 */
export const createUser = createUserFn;
