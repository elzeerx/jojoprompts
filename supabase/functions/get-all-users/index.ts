import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from './cors.ts';
import { verifyAdmin } from './auth.ts';
import { listUsers, deleteUser, updateUser, createUser } from './users.ts';

serve(async (req) => {
  try {
    // Handle CORS preflight request
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    // 🚩: Defensive handling of auth errors: always return 401/403 with clear error if thrown by verifyAdmin, 
    // not just generic 500.
    let supabase, userId;
    try {
      ({ supabase, userId } = await verifyAdmin(req));
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("Unauthorized")) {
        return new Response(JSON.stringify({
          error: "Unauthorized: Invalid token or authentication required",
          message: err?.message,
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (msg.includes("Forbidden")) {
        return new Response(JSON.stringify({
          error: "Forbidden: Admin role required",
          message: err?.message,
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // If not an expected "access" error, bubble up as server error
      return new Response(JSON.stringify({
        error: 'Server error',
        message: err?.message || 'Unexpected error occurred',
      }), {
        status: 500,
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
    // Always bubble up actual server faults only here.
    return new Response(JSON.stringify({
      error: 'Server error',
      message: error.message || 'An unexpected error occurred',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
