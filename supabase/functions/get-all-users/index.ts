import { serve, corsHeaders, handleCors, createErrorResponse, createSuccessResponse } from "../_shared/standardImports.ts";
import { verifyAdmin } from "../_shared/adminAuth.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleCors();
  }

  try {
    // Admin authentication using shared module
    const { supabase, userId } = await verifyAdmin(req);
    
    // Handle GET - list users with pagination and search
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const search = url.searchParams.get('search') || '';
      
      const offset = (page - 1) * limit;
      
      console.log(`[GET USERS] Fetching users - page: ${page}, limit: ${limit}, search: "${search}"`);
      
      // Build query
      let query = supabase
        .from('profiles')
        .select('*, user_subscriptions(*, subscription_plans(*))', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (search) {
        query = query.or(`email.ilike.%${search}%,username.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
      }
      
      const { data: profiles, error, count } = await query;
      
      if (error) {
        console.error('[GET USERS ERROR]', error);
        throw error;
      }
      
      console.log(`[GET USERS SUCCESS] Found ${count} total users, returning ${profiles?.length || 0} users`);
      
      return createSuccessResponse({
        users: profiles,
        total: count,
        totalPages: Math.ceil((count || 0) / limit)
      });
    }
    
    // Handle POST - delete/update operations
    if (req.method === 'POST') {
      const body = await req.json();
      const { action, userId: targetUserId } = body;
      
      console.log(`[POST ACTION] Action: ${action}, Target User: ${targetUserId}`);
      
      if (action === 'delete') {
        // Call the existing admin_delete_user_data function
        const { data, error } = await supabase.rpc('admin_delete_user_data', {
          target_user_id: targetUserId
        });
        
        if (error) {
          console.error('[DELETE USER ERROR]', error);
          throw error;
        }
        
        console.log('[DELETE USER SUCCESS]', data);
        
        return createSuccessResponse(data);
      }
      
      return createErrorResponse('Invalid action', 400);
    }
    
    return createErrorResponse('Method not allowed', 405);

  } catch (error: any) {
    console.error('[ERROR] get-all-users function failed:', {
      message: error.message,
      timestamp: new Date().toISOString(),
      method: req.method,
      hasAuthHeader: !!req.headers.get('authorization')
    });

    // Determine appropriate status code based on error
    const status = error.message === 'UNAUTHORIZED' ? 401 :
                   error.message === 'FORBIDDEN' ? 403 : 500;
    
    return createErrorResponse(error.message, status);
  }
});
