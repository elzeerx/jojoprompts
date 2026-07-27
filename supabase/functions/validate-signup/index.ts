// Archival stub — RETIRED.
//
// The previous implementation was an account-enumeration surface: any
// caller could POST an email/username and receive a structured
// existence/validity verdict before any signup attempt. Signup now
// relies exclusively on Supabase Auth's own responses, which are
// intentionally generic. No custom endpoint should probe existence.
//
// Source-only. Intentionally NOT deployed in this pass. If a future
// intentional deploy happens, it responds with HTTP 410 Gone and no
// elevated-privilege, admin API, email sending, or payment logic
// remains.

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
      error: "endpoint_retired",
      message:
        "Pre-signup validation probing is retired. Rely on Supabase Auth's own signUp response.",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
