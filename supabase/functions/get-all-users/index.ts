import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { corsHeaders } from "./cors.ts";
import { deleteUser } from "./userDeletion.ts";

// Simple validation functions inlined to avoid import issues
function validateRequest(req: Request): { isValid: boolean; error?: string } {
  const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
  if (!allowedMethods.includes(req.method)) {
    return { isValid: false, error: 'Invalid request method' };
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { isValid: false, error: 'Missing or invalid authorization header' };
  }

  return { isValid: true };
}

async function authenticateAdmin(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') as string;

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error('Missing required environment variables');
  }

  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.slice(7); // Remove 'Bearer ' prefix

  if (!token) {
    throw new Error('No token provided');
  }

  // Create anon client to validate user token
  const anonClient = createClient(supabaseUrl, anonKey);
  const { data: { user }, error: userError } = await anonClient.auth.getUser(token);

  if (userError || !user) {
    throw new Error('Invalid token');
  }

  // Create service role client for operations
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Get user profile to check role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || !['admin', 'jadmin'].includes(profile.role)) {
    throw new Error('Insufficient permissions - admin role required');
  }

  return { supabase, userId: user.id, userRole: profile.role };
}

serve(async (req) => {
  console.log(`[${req.method}] Edge function called:`, req.url);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Basic request validation
    const validation = validateRequest(req);
    if (!validation.isValid) {
      console.error('Request validation failed:', validation.error);
      return new Response(
        JSON.stringify({ error: validation.error }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Authenticate admin
    const { supabase, userId, userRole } = await authenticateAdmin(req);
    console.log(`Successfully authenticated admin user ${userId} with role ${userRole}`);

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        // Simple user listing for admin
        const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
        
        if (usersError) {
          throw new Error(`Failed to fetch users: ${usersError.message}`);
        }

        return new Response(
          JSON.stringify({ users: users.users || [] }), 
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );

      case 'POST':
        try {
          const requestBody = await req.json();
          console.log('[POST] Received request body:', { action: requestBody.action, userId: requestBody.userId });
          
          // Handle delete actions sent via POST
          if (requestBody.action === 'delete') {
            console.log('[POST] Processing delete action for user:', requestBody.userId);
            
            if (!requestBody.userId) {
              return new Response(
                JSON.stringify({ error: 'User ID is required for delete action' }), 
                { 
                  status: 400, 
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
                }
              );
            }

            // Only admin role can delete users, not jadmin
            if (userRole !== 'admin') {
              return new Response(
                JSON.stringify({ error: 'Insufficient permissions - admin role required for user deletion' }), 
                { 
                  status: 403, 
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
                }
              );
            }

            // Check if user exists before deletion
            const { data: existingUser, error: userCheckError } = await supabase
              .from('profiles')
              .select('id, role')
              .eq('id', requestBody.userId)
              .maybeSingle();
              
            if (userCheckError || !existingUser) {
              return new Response(
                JSON.stringify({ error: 'User not found' }), 
                { 
                  status: 404, 
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
                }
              );
            }

            // Prevent deleting other admins
            if (existingUser.role === 'admin' && userId !== requestBody.userId) {
              return new Response(
                JSON.stringify({ error: 'Cannot delete another administrator' }), 
                { 
                  status: 403, 
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
                }
              );
            }

            // Use the comprehensive deleteUser function
            const deletionResult = await deleteUser(supabase, requestBody.userId, userId);

            return new Response(
              JSON.stringify(deletionResult), 
              { 
                status: 200, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          }

          return new Response(
            JSON.stringify({ error: 'Unsupported action' }), 
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );

        } catch (error: any) {
          console.error('[POST] Error processing POST request:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to process POST request', details: error.message }), 
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }), 
          { 
            status: 405, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }

  } catch (error: any) {
    console.error('Critical error in get-all-users function:', {
      message: error.message,
      stack: error.stack?.substring(0, 500),
      timestamp: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message || 'An unexpected error occurred' 
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});