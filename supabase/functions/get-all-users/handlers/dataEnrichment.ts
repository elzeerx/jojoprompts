import { createEdgeLogger } from '../../_shared/logger.ts';

const logger = createEdgeLogger('get-all-users:data-enrichment');

/**
 * Build a map of user roles with priority handling
 * Priority: admin > jadmin > prompter > user
 */
export function buildRoleMap(userRoleData: any[]): Map<string, string> {
  const roleMap = new Map<string, string>();
  const rolePriority: Record<string, number> = { admin: 1, jadmin: 2, prompter: 3, user: 4 };
  
  if (!userRoleData) return roleMap;
  
  userRoleData.forEach(ur => {
    if (!roleMap.has(ur.user_id)) {
      roleMap.set(ur.user_id, ur.role);
    } else {
      const currentRole = roleMap.get(ur.user_id);
      if ((rolePriority[ur.role] || 5) < (rolePriority[currentRole!] || 5)) {
        roleMap.set(ur.user_id, ur.role);
      }
    }
  });
  
  return roleMap;
}

/**
 * Fetch auth data for specific user IDs using batched getUserById
 * This ensures we get auth data for ALL users, not just the first page from listUsers
 */
export async function fetchAuthData(supabase: any, profileIds: string[], requestId: string) {
  const startTime = Date.now();
  const authUserMap = new Map();
  const BATCH_SIZE = 25;
  
  try {
    // Batch process user IDs to avoid overwhelming the API
    for (let i = 0; i < profileIds.length; i += BATCH_SIZE) {
      const batch = profileIds.slice(i, i + BATCH_SIZE);
      
      const results = await Promise.all(
        batch.map(async (userId) => {
          try {
            const { data, error } = await supabase.auth.admin.getUserById(userId);
            if (!error && data?.user) {
              return { id: userId, user: data.user };
            }
          } catch (err) {
            logger.warn('Failed to fetch auth data for user', { userId, error: err });
          }
          return { id: userId, user: null };
        })
      );
      
      // Add successful results to map
      results.forEach(result => {
        if (result.user) {
          authUserMap.set(result.id, result.user);
        }
      });
    }
  } catch (authFetchError) {
    logger.warn('Auth data fetch failed', { requestId, error: authFetchError });
  }
  
  logger.debug('Auth data fetched', { 
    duration_ms: Date.now() - startTime,
    authUsersFound: authUserMap.size,
    profileCount: profileIds.length,
    coverage: `${Math.round((authUserMap.size / profileIds.length) * 100)}%`
  });
  
  return authUserMap;
}

/**
 * Fetch subscription data for specific user IDs
 */
export async function fetchSubscriptionData(supabase: any, profileIds: string[], requestId: string) {
  const startTime = Date.now();
  const subscriptionMap = new Map();
  
  try {
    const { data: subscriptions, error: subscriptionError } = await supabase
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
          is_lifetime,
          duration_days
        )
      `)
      .in('user_id', profileIds)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (subscriptionError) {
      logger.warn('Error fetching subscriptions', { requestId, error: subscriptionError });
    } else if (subscriptions) {
      subscriptions.forEach((sub: any) => {
        if (!subscriptionMap.has(sub.user_id)) {
          subscriptionMap.set(sub.user_id, sub);
        }
      });
    }
  } catch (subFetchError) {
    logger.warn('Subscription fetch failed', { requestId, error: subFetchError });
  }
  
  logger.debug('Subscription data fetched', {
    duration_ms: Date.now() - startTime,
    subscriptionsFound: subscriptionMap.size,
    profileCount: profileIds.length
  });
  
  return subscriptionMap;
}

/**
 * Enrich user profiles with auth, role, and subscription data
 */
export function enrichUserProfiles(
  profiles: any[],
  authUserMap: Map<string, any>,
  roleMap: Map<string, string>,
  subscriptionMap: Map<string, any>
) {
  return profiles.map((profile: any) => {
    const authUser = authUserMap.get(profile.id);
    const subscription = subscriptionMap.get(profile.id);
    const userRole = roleMap.get(profile.id) || 'user';

    return {
      // Core identity
      id: profile.id,
      
      // Profile data
      first_name: profile.first_name,
      last_name: profile.last_name,
      username: profile.username,
      role: userRole,
      bio: profile.bio,
      avatar_url: profile.avatar_url,
      country: profile.country,
      phone_number: profile.phone_number,
      timezone: profile.timezone,
      membership_tier: profile.membership_tier || 'free',
      social_links: profile.social_links || {},
      created_at: profile.created_at,
      
      // Auth data
      email: authUser?.email || null,
      email_confirmed_at: authUser?.email_confirmed_at || null,
      is_email_confirmed: authUser?.email_confirmed_at ? true : (authUser ? false : null),
      last_sign_in_at: authUser?.last_sign_in_at || null,
      auth_created_at: authUser?.created_at || null,
      auth_updated_at: authUser?.updated_at || null,
      
      // Subscription data
      subscription: subscription ? {
        plan_id: subscription.subscription_plans?.id,
        plan_name: subscription.subscription_plans?.name || 'Unknown',
        price_usd: subscription.subscription_plans?.price_usd || 0,
        is_lifetime: subscription.subscription_plans?.is_lifetime || false,
        duration_days: subscription.subscription_plans?.duration_days,
        status: subscription.status,
        start_date: subscription.start_date,
        end_date: subscription.end_date,
        payment_method: subscription.payment_method,
        subscription_created_at: subscription.created_at
      } : null
    };
  });
}
