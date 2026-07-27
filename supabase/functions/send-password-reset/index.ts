// Archival stub — RETIRED.
//
// The previous implementation used a custom raw reset-token flow with
// elevated privileges to generate its own reset links. Password reset
// is now handled exclusively by the official Supabase Auth flow
// (`supabase.auth.resetPasswordForEmail` → recovery URL → session →
// `supabase.auth.updateUser`). No custom endpoint should mint or
// deliver reset links.
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
        "Custom password reset is retired. Use Supabase Auth's built-in resetPasswordForEmail flow.",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
