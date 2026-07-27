// Archival stub — RETIRED.
//
// V2 commerce is served by `v2-upayments-*` (checkout, status, refund,
// webhook). PayPal is not an accepted payment provider and no client
// or server path should invoke it. The previous implementation
// processed provider webhooks with elevated privileges and mutated
// order/payment state; that surface is removed here.
//
// Source-only. Intentionally NOT deployed in this pass. If a future
// intentional deploy happens, it responds with HTTP 410 Gone and no
// elevated-privilege, admin API, email sending, or payment mutation
// logic remains.

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
      message: "PayPal webhook processing is retired. V2 commerce uses v2-upayments-* only.",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
