// v2-admin-email-settings-status
// Admin-only, read-only safe configuration status for the transactional email
// stack (Resend via Supabase Edge Functions). Never returns secret values,
// token fragments, or lengths, and never performs a provider/DNS/SMTP call.

import {
  corsHeadersFor, jsonResponse, methodGuard, requireAdmin,
} from "../_shared/v2Upayments.ts";

// Fixed, public sender identity used by the `send-email` function.
const SENDER_NAME = "JoJo Prompts";
const SENDER_ADDRESS = "info@jojoprompts.com";
const REPLY_TO = "info@jojoprompts.com";
const DOMAIN = "jojoprompts.com";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeadersFor(origin) });
  }
  const g = methodGuard(req, "POST");
  if (g) return g;

  const admin = await requireAdmin(req);
  if ("error" in admin) return admin.error;

  const providerApiKeyConfigured =
    !!(Deno.env.get("RESEND_API_KEY") ?? "").trim();
  const configured = providerApiKeyConfigured;

  const body = {
    provider: "resend" as const,
    transport: "edge_functions" as const,
    configured,
    provider_api_key_configured: providerApiKeyConfigured,
    sender_name: SENDER_NAME,
    sender_address: SENDER_ADDRESS,
    reply_to: REPLY_TO,
    domain: DOMAIN,
    provider_health_check: "not_checked" as const,
    domain_verification: "not_checked" as const,
    auth_email_transport: "separate_not_checked" as const,
    primary_service: "send-email" as const,
    services: [
      "send-email",
      "send-signup-confirmation",
      "send-welcome-email",
      "send-purchase-confirmation",
      "send-password-reset",
    ] as const,
  };

  const res = jsonResponse(body, 200, origin);
  res.headers.set("Cache-Control", "no-store");
  return res;
});
