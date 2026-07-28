import { createEdgeLogger } from '../../_shared/logger.ts';
import { createClient } from "../../_shared/standardImports.ts";

const logger = createEdgeLogger('get-all-users:data-enrichment');
type AdminClient = ReturnType<typeof createClient>;

interface UserRoleRow {
  user_id: string;
  role: string;
}

interface AuthUserRecord {
  email?: string;
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  banned_until?: string | null;
}

interface ProfileRecord {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  email?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  country?: string | null;
  phone_number?: string | null;
  timezone?: string | null;
  membership_tier?: string | null;
  social_links?: Record<string, unknown> | null;
  created_at?: string | null;
}

/**
 * Build a map of user roles with priority handling
 * Priority: admin > jadmin > prompter > user
 */
export function buildRoleMap(userRoleData: UserRoleRow[]): Map<string, string> {
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
export async function fetchAuthData(
  supabase: AdminClient,
  profileIds: string[],
  requestId: string,
): Promise<Map<string, AuthUserRecord>> {
  const startTime = Date.now();
  const authUserMap = new Map<string, AuthUserRecord>();
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
 * Enrich user profiles with Auth and role data.
 */
export function enrichUserProfiles(
  profiles: ProfileRecord[],
  authUserMap: Map<string, AuthUserRecord>,
  roleMap: Map<string, string>
) {
  return profiles.map((profile) => {
    const authUser = authUserMap.get(profile.id);
    const userRole = roleMap.get(profile.id) || 'user';
    const bannedUntil = typeof authUser?.banned_until === 'string'
      ? Date.parse(authUser.banned_until)
      : Number.NaN;

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
      email: authUser?.email || profile.email || null,
      email_confirmed_at: authUser?.email_confirmed_at || null,
      is_email_confirmed: authUser?.email_confirmed_at ? true : (authUser ? false : null),
      last_sign_in_at: authUser?.last_sign_in_at || null,
      auth_created_at: authUser?.created_at || null,
      auth_updated_at: authUser?.updated_at || null,
      account_disabled:
        Number.isFinite(bannedUntil) && bannedUntil > Date.now(),
      
      // Orphaned profile detection
      has_auth_account: !!authUser,
    };
  });
}
