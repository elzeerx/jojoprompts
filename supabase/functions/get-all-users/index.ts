
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from './cors.ts';
import { verifyAdmin } from './auth.ts';
import { listUsers, deleteUser, updateUser, createUser } from './users.ts';

serve(async (req) => {
  try {
    // Handle CORS preflight request
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    // Verify admin access and get Supabase client
    const { supabase, userId } = await verifyAdmin(req);

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

    const { action } = requestData;
    let response;

    // Handle different actions
    switch (action) {
      case 'delete':
        response = await deleteUser(supabase, requestData.userId, userId);
        break;
      case 'update':
        response = await updateUser(supabase, requestData.userId, requestData.userData, userId);
        break;
      case 'create':
        response = await createUser(supabase, requestData.userData, userId);
        break;
      default: // 'list' is the default action
        response = await listUsers(supabase, userId);
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({
      error: 'Server error',
      message: error.message || 'An unexpected error occurred',
    }), {
      status: error.message?.includes('Unauthorized') ? 401 : 
             error.message?.includes('Forbidden') ? 403 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
