// Archival stub — RETIRED.
//
// The previous implementation used SUPABASE_SERVICE_ROLE_KEY to
// generate invite links for arbitrary caller-supplied emails and to
// send confirmation mail without any caller authentication. That is a
// spam / account-abuse surface. Client signup now relies exclusively
// on Supabase Auth's built-in `auth.signUp` / `auth.signInWithOtp`
// flows and their generic responses.
//
// Source-only. Intentionally NOT deployed in this pass. If a future
// intentional deploy happens, it responds with HTTP 410 Gone.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "X-Content-Type-Options": "nosniff",
};

serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }
  return new Response(
    JSON.stringify({
      success: false,
      error: "endpoint_retired",
      message: "This endpoint has been retired. Use Supabase Auth's built-in signup / magic-link flow.",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
