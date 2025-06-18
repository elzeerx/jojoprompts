
import { corsHeaders } from "../cors.ts";
import { logAdminAction } from "../../shared/securityLogger.ts";

export async function handleGetUsers(supabase: any, adminId: string, req: Request) {
  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 100);
    const search = url.searchParams.get('search') || '';
    
    // Validate pagination parameters
    if (page < 1 || limit < 1) {
      return new Response(
        JSON.stringify({ error: 'Invalid pagination parameters' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log the user list access
    await logAdminAction(supabase, adminId, 'list_users', 'users', {
      page,
      limit,
      search_query: search ? 'provided' : 'none'
    });

    // Calculate offset for pagination
    const offset = (page - 1) * limit;
    
    // Build query with search functionality
    let query = supabase
      .from('profiles')
      .select('id, first_name, last_name, role, created_at, membership_tier', { count: 'exact' });
    
    // Add search filter if provided
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
    }
    
    // Add pagination
    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });
    
    // Execute query
    const { data: users, error, count } = await query;
    
    if (error) {
      console.error('Database error when fetching users:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users from database' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Get user emails from auth.users table
    const userIds = users.map((user: any) => user.id);
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers({
      perPage: userIds.length,
      page: 1
    });
    
    // Merge profile data with email from auth
    const enrichedUsers = users.map((user: any) => {
      const authUser = authUsers?.users?.find((au: any) => au.id === user.id);
      return {
        ...user,
        email: authUser?.email || 'unknown',
        emailConfirmed: !!authUser?.email_confirmed_at
      };
    });
    
    return new Response(
      JSON.stringify({ 
        users: enrichedUsers, 
        total: count || enrichedUsers.length, 
        page, 
        limit,
        totalPages: count ? Math.ceil(count / limit) : 1
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('Error in handleGetUsers:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch users' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}
