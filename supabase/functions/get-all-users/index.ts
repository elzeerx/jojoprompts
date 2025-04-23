
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
    
    // Create client with service role key for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if the user is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized - Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized - Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log(`User ${user.id} is attempting to access admin functionality`);
    
    // Verify admin role using the profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return new Response(JSON.stringify({ error: 'Error fetching user profile', details: profileError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (profile?.role !== 'admin') {
      console.error(`User ${user.id} is not an admin. Role: ${profile?.role}`);
      return new Response(JSON.stringify({ error: 'Forbidden - Admin role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Check if this is a delete request
    if (req.method === 'POST') {
      try {
        const { userId, action } = await req.json();
        
        if (action === 'delete' && userId) {
          console.log(`Admin ${user.id} is attempting to delete user ${userId}`);
          
          // Delete the user with service role client
          const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
          
          if (deleteError) {
            console.error(`Error deleting user ${userId}:`, deleteError);
            return new Response(JSON.stringify({ error: 'Error deleting user', details: deleteError.message }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          console.log(`Successfully deleted user ${userId}`);
          return new Response(JSON.stringify({ success: true, message: 'User deleted successfully' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (parseError) {
        console.error('Error parsing JSON body:', parseError);
        return new Response(JSON.stringify({ error: 'Invalid JSON body', details: parseError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    // Default behavior: Get all users
    console.log(`Admin ${user.id} is fetching all users`);
    const { data: users, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.error('Error listing users:', error);
      return new Response(JSON.stringify({ error: 'Error fetching users', details: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Format the response
    const formattedUsers: User[] = users.users.map(user => ({
      id: user.id,
      email: user.email || '',
      created_at: user.created_at || '',
      last_sign_in_at: user.last_sign_in_at,
    }));
    
    return new Response(JSON.stringify(formattedUsers), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({ 
      error: 'Server error', 
      message: error.message || 'An unexpected error occurred',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
