
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
      .maybeSingle();
      
    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return new Response(JSON.stringify({ error: 'Error fetching user profile', details: profileError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (!profile || profile.role !== 'admin') {
      console.error(`User ${user.id} is not an admin. Role: ${profile?.role || 'unknown'}`);
      return new Response(JSON.stringify({ error: 'Forbidden - Admin role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Parse the request body safely
    let requestData = { action: "list" };
    try {
      if (req.headers.get('content-type')?.includes('application/json')) {
        const body = await req.text();
        if (body) {
          requestData = JSON.parse(body);
        }
      }
    } catch (e) {
      console.error('Failed to parse request body:', e);
    }
    
    // Handle different actions based on request
    const { action, userId, userData } = requestData;
    
    // DELETE USER
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
    
    // UPDATE USER
    if (action === 'update' && userId && userData) {
      console.log(`Admin ${user.id} is attempting to update user ${userId}`, userData);
      
      // Update the user with service role client
      const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
        userId,
        userData
      );
      
      if (updateError) {
        console.error(`Error updating user ${userId}:`, updateError);
        return new Response(JSON.stringify({ error: 'Error updating user', details: updateError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      console.log(`Successfully updated user ${userId}`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'User updated successfully',
        user: updateData.user
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // CREATE USER
    if (action === 'create' && userData) {
      console.log(`Admin ${user.id} is attempting to create a new user`, userData);
      
      // Create the user with service role client
      const { data: createData, error: createError } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true, // Automatically confirm the email
        user_metadata: {
          first_name: userData.first_name,
          last_name: userData.last_name
        }
      });
      
      if (createError) {
        console.error(`Error creating user:`, createError);
        return new Response(JSON.stringify({ error: 'Error creating user', details: createError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      console.log(`Successfully created user ${createData.user.id}`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'User created successfully',
        user: createData.user
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Default behavior: Get all users (for action 'list' or if no action specified)
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
