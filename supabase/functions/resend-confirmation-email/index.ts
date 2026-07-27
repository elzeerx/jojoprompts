// Archival stub — RETIRED.
//
// The previous implementation used the service-role key to list every
// auth user, generate invite links, and send email without caller
// authentication. That is an account-enumeration and abuse surface.
// It has been replaced in the client with Supabase Auth's built-in
// resend / OTP flows.
//
// This stub is source-only. It is intentionally NOT deployed in the
// current pass. If a future intentional deploy happens, it will
// respond with HTTP 410 Gone and no elevated-privilege, admin API,
// or email sending behavior remains.

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
      message: "This endpoint has been retired. Use Supabase Auth's built-in resend flow.",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
