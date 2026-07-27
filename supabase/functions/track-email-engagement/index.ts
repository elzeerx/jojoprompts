// Archival stub — RETIRED.
//
// The previous implementation accepted an unauthenticated raw email
// via a public tracking-pixel GET and wrote engagement rows keyed to
// that email. That both discloses recipient addresses to URL logs and
// lets any caller forge engagement events. Public email tracking is
// removed. Legitimate transactional delivery is unaffected.
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
      message: "Public email engagement tracking is retired.",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
