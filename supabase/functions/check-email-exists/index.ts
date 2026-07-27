// Archival stub — RETIRED.
//
// The previous implementation was an unauthenticated account
// enumeration oracle: any caller could POST an email and learn
// whether a matching profile row existed. Client auth surfaces
// (SmartAuthForm, ExpressCheckoutModal) no longer probe existence
// before showing sign-in vs sign-up; Supabase Auth authoritatively
// rejects duplicate signups with a generic response.
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
      error: "endpoint_retired",
      message: "Account-existence probing is retired. Rely on Supabase Auth's own responses.",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
