import { createEdgeLogger } from '../../_shared/logger.ts';

const logger = createEdgeLogger('get-all-users:query-builder');

export interface PaginationParams {
  page: number;
  limit: number;
  search: string;
}

/**
 * Validate pagination parameters
 */
export function validatePagination(page: number, limit: number): { valid: boolean; error?: string } {
  if (page < 1 || limit < 1) {
    return { 
      valid: false, 
      error: 'Invalid pagination parameters' 
    };
  }
  return { valid: true };
}

/**
 * Build profile query with search and pagination
 */
export function buildProfileQuery(supabase: any, params: PaginationParams) {
  const { page, limit, search } = params;
  
  let profileQuery = supabase
    .from('profiles')
    .select(`
      id,
      first_name,
      last_name,
      username,
      bio,
      avatar_url,
      country,
      phone_number,
      timezone,
      membership_tier,
      social_links,
      created_at
    `, { count: 'exact' });

  // Apply search filter on multiple fields
  if (search) {
    profileQuery = profileQuery.or(`
      first_name.ilike.%${search}%,
      last_name.ilike.%${search}%,
      username.ilike.%${search}%,
      email.ilike.%${search}%
    `);
  }

  // Apply pagination at database level
  const offset = (page - 1) * limit;
  profileQuery = profileQuery
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  return profileQuery;
}

/**
 * Fetch user roles for given profile IDs
 */
export async function fetchUserRoles(supabase: any, profileIds: string[]) {
  const { data: userRoleData, error: roleError } = await supabase
    .from('user_roles')
    .select('user_id, role')
    .in('user_id', profileIds);
  
  if (roleError) {
    logger.warn('Error fetching user roles', { error: roleError });
  }
  
  return userRoleData || [];
}
