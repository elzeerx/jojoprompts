// Archival stub — RETIRED.
//
// The previous implementation accepted an unauthenticated raw email
// and sent mail on demand — a spam/abuse surface. Signup email
// confirmation is handled by Supabase Auth's own signUp flow; there
// is no supported client trigger for arbitrary reminder mail.
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
      message: "Client-triggered confirmation reminders are retired.",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
