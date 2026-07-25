// v2-admin-payment-settings-status
// Admin-only, read-only safe configuration status for the UPayments provider.
// Never returns secret values, token fragments, or lengths. No provider calls.

import {
  corsHeadersFor, jsonResponse, methodGuard, requireAdmin, loadPublicSiteUrl,
} from "../_shared/v2Upayments.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeadersFor(origin) });
  }
  const g = methodGuard(req, "POST");
  if (g) return g;

  const admin = await requireAdmin(req);
  if ("error" in admin) return admin.error;

  const enabled = Deno.env.get("V2_UPAYMENTS_ENABLED") === "true";
  const envRaw = (Deno.env.get("V2_UPAYMENTS_ENVIRONMENT") ?? "").trim();
  const environment: "sandbox" | "production" | "invalid_or_unset" =
    envRaw === "sandbox" ? "sandbox"
    : envRaw === "production" ? "production"
    : "invalid_or_unset";
  const apiTokenConfigured = !!(Deno.env.get("V2_UPAYMENTS_API_TOKEN") ?? "").trim();
  const publicSiteUrl = loadPublicSiteUrl();
  const publicSiteUrlConfigured = typeof publicSiteUrl === "string" && publicSiteUrl.length > 0;
  const configured =
    enabled &&
    environment !== "invalid_or_unset" &&
    apiTokenConfigured &&
    publicSiteUrlConfigured;

  const body = {
    provider: "upayments" as const,
    enabled,
    configured,
    environment,
    api_token_configured: apiTokenConfigured,
    public_site_url_configured: publicSiteUrlConfigured,
    public_site_url: publicSiteUrl,
    currency: "KWD" as const,
    recurring_billing: false,
    services: [
      "v2-upayments-checkout",
      "v2-upayments-webhook",
      "v2-upayments-status",
      "v2-upayments-refund",
    ] as const,
  };

  const res = jsonResponse(body, 200, origin);
  res.headers.set("Cache-Control", "no-store");
  return res;
});
