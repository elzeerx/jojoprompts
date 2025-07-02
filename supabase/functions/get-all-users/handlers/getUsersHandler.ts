
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
    
    // Get user emails from auth.users table with pagination
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers({
      perPage: limit,
      page: page
    });
    
    if (authError) {
      console.error('Error fetching auth users:', authError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users from auth' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get total count of auth users for pagination info
    const { data: allAuthUsers, error: countError } = await supabase.auth.admin.listUsers();
    const totalUsers = allAuthUsers?.users?.length || 0;

    // Get user IDs from auth response
    let userIds = authUsers?.users?.map((user: any) => user.id) || [];
    
    // Apply search filter on auth data if needed
    let filteredAuthUsers = authUsers?.users || [];
    if (search) {
      filteredAuthUsers = authUsers?.users?.filter((user: any) => 
        user.email?.toLowerCase().includes(search.toLowerCase())
      ) || [];
      userIds = filteredAuthUsers.map((user: any) => user.id);
    }
    
    // If we have user IDs, get their profiles
    let profiles = [];
    if (userIds.length > 0) {
      const { data: profilesData, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, username, role, created_at')
        .in('id', userIds);
      
      if (profileError) {
        console.error('Database error when fetching profiles:', profileError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch user profiles' }), 
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      profiles = profilesData || [];
    }
    
    // Merge profile data with email from auth
    const enrichedUsers = filteredAuthUsers.map((authUser: any) => {
      const profile = profiles.find((p: any) => p.id === authUser.id);
      return {
        id: authUser.id,
        email: authUser.email || 'unknown',
        emailConfirmed: !!authUser.email_confirmed_at,
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at,
        first_name: profile?.first_name || null,
        last_name: profile?.last_name || null,
        role: profile?.role || 'user',
        username: profile?.username || ''
      };
    });
    
    // Calculate pagination info
    const totalPages = Math.ceil(totalUsers / limit);
    
    return new Response(
      JSON.stringify({ 
        users: enrichedUsers, 
        total: totalUsers, 
        page, 
        limit,
        totalPages
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
