// Archival stub — RETIRED.
//
// The previous implementation accepted a raw caller-supplied token and
// changed the target account's password via elevated privileges. That
// entire code path is superseded by Supabase Auth's own recovery
// session + `supabase.auth.updateUser` on the client. No custom
// endpoint should verify reset tokens or set passwords.
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
        "Custom password-reset verification is retired. Use Supabase Auth's recovery session + updateUser.",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
