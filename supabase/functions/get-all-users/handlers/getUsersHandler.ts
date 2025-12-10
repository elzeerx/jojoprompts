import { createEdgeLogger } from '../../_shared/logger.ts';
import { logAdminAction } from "../../shared/securityLogger.ts";
import { validatePagination, buildProfileQuery, fetchUserRoles } from './queryBuilder.ts';
import { fetchAuthData, fetchSubscriptionData, buildRoleMap, enrichUserProfiles } from './dataEnrichment.ts';
import {
  buildSuccessResponse,
  buildEmptyResponse,
  buildPaginationErrorResponse,
  buildValidationErrorResponse,
  buildErrorResponse
} from './responseBuilder.ts';

const logger = createEdgeLogger('get-all-users:get-users');

export async function handleGetUsers(supabase: any, adminId: string, req: Request) {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 100);
    const search = url.searchParams.get('search') || '';
    
    logger.info('Starting getUsersHandler', { requestId, page, limit, search });
    
    // Validate pagination parameters
    const validation = validatePagination(page, limit);
    if (!validation.valid) {
      logger.warn('Invalid pagination parameters', { requestId, page, limit });
      return buildValidationErrorResponse(validation.error!, { page, limit });
    }

    // Log admin action for audit trail
    await logAdminAction(supabase, adminId, 'list_users', 'users', {
      request_id: requestId,
      page,
      limit,
      search_query: search ? 'provided' : 'none',
      user_agent: req.headers.get('user-agent'),
      timestamp: new Date().toISOString()
    });

    // Fetch profiles with search and pagination
    const profileQuery = buildProfileQuery(supabase, { page, limit, search });
    const { data: profiles, error: profileError, count: totalFilteredUsers } = await profileQuery;

    if (profileError) {
      logger.error('Error fetching profiles', { requestId, error: profileError });
      throw new Error(`Failed to fetch user profiles: ${profileError.message}`);
    }

    // Handle empty results
    if (!profiles || profiles.length === 0) {
      logger.info('No profiles found for page', { requestId, page });
      return buildEmptyResponse(
        totalFilteredUsers || 0,
        page,
        limit,
        requestId,
        Date.now() - startTime,
        search
      );
    }

    // Fetch related data for enrichment
    const profileIds = profiles.map(p => p.id);
    
    const [userRoleData, authUserMap, subscriptionMap] = await Promise.all([
      fetchUserRoles(supabase, profileIds),
      fetchAuthData(supabase, profileIds, requestId),
      fetchSubscriptionData(supabase, profileIds, requestId)
    ]);
    
    const roleMap = buildRoleMap(userRoleData);

    // Validate page range
    const totalPages = Math.ceil((totalFilteredUsers || 0) / limit);
    if (page > totalPages && totalFilteredUsers > 0) {
      logger.warn('Page exceeds available pages', { requestId, page, totalPages });
      return buildPaginationErrorResponse(
        'Page exceeds available data',
        page,
        totalPages,
        totalFilteredUsers || 0
      );
    }
    
    // Enrich profiles with all related data
    const enrichedUsers = enrichUserProfiles(profiles, authUserMap, roleMap, subscriptionMap);
    
    logger.info('Request completed successfully', { 
      requestId, 
      returnedUsers: enrichedUsers.length 
    });
    
    return buildSuccessResponse(
      enrichedUsers,
      totalFilteredUsers || 0,
      page,
      limit,
      {
        requestId,
        totalDuration: Date.now() - startTime,
        cacheHit: false,
        searchActive: !!search,
        dataEnrichment: {
          profilesEnriched: enrichedUsers.length,
          authDataAvailable: authUserMap.size,
          subscriptionsAvailable: subscriptionMap.size
        }
      }
    );
    
  } catch (error: any) {
    const errorDuration = Date.now() - startTime;
    logger.error('Error in handleGetUsers', { 
      requestId, 
      duration_ms: errorDuration, 
      error: error.message 
    });
    
    return buildErrorResponse(error.message, requestId, errorDuration);
  }
}
