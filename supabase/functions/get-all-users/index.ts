import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAdminSimple } from "./simpleAuth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Simple admin authentication using new secure role system
    const { supabase, userId } = await verifyAdminSimple(req);
    
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
      
      return new Response(
        JSON.stringify({
          users: profiles,
          total: count,
          totalPages: Math.ceil((count || 0) / limit)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
        
        return new Response(
          JSON.stringify(data),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

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
    
    const errorCode = error.message === 'UNAUTHORIZED' ? 'UNAUTHORIZED' :
                      error.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'INTERNAL_ERROR';
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        code: errorCode
      }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
