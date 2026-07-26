// v2-admin-integrations-settings-status
// Admin-only, read-only safe inventory of the third-party integrations that
// JojoPrompts actually uses. Reports only whether the required server
// configuration is present (booleans + safe literals). Never returns secret
// values, key fragments, lengths, headers, environment data, or provider
// response bodies. Never calls a provider, sends email, scans files, creates
// payments, generates AI content, or invokes MCP tools.

import {
  corsHeadersFor, jsonResponse, methodGuard, requireAdmin, loadPublicSiteUrl,
} from "../_shared/v2Upayments.ts";

// Public, non-secret literals. All URLs are known publishable identifiers.
const MCP_ENDPOINT =
  "https://fxkqgjakbyrxkmevkglv.supabase.co/functions/v1/mcp";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeadersFor(origin) });
  }
  const g = methodGuard(req, "POST");
  if (g) return g;

  const admin = await requireAdmin(req);
  if ("error" in admin) return admin.error;

  // ---------- UPayments ----------
  const upEnabled = Deno.env.get("V2_UPAYMENTS_ENABLED") === "true";
  const upEnvRaw = (Deno.env.get("V2_UPAYMENTS_ENVIRONMENT") ?? "").trim();
  const upEnvironment: "sandbox" | "production" | "not_configured" =
    upEnvRaw === "sandbox" ? "sandbox"
    : upEnvRaw === "production" ? "production"
    : "not_configured";
  const upTokenConfigured =
    !!(Deno.env.get("V2_UPAYMENTS_API_TOKEN") ?? "").trim();
  const upSiteUrlConfigured = typeof loadPublicSiteUrl() === "string";
  const upConfigured =
    upEnabled && upEnvironment !== "not_configured" &&
    upTokenConfigured && upSiteUrlConfigured;

  // ---------- Resend ----------
  const resendConfigured =
    !!(Deno.env.get("RESEND_API_KEY") ?? "").trim();

  // ---------- Cloudmersive ----------
  const cmsApiKeyConfigured =
    !!(Deno.env.get("CLOUDMERSIVE_API_KEY") ?? "").trim();
  const cmsWorkerSecretConfigured =
    !!(Deno.env.get("PACKAGE_SCAN_WORKER_SECRET") ?? "").trim();
  const cmsConfigured = cmsApiKeyConfigured && cmsWorkerSecretConfigured;

  // ---------- Lovable AI Gateway ----------
  const lovableConfigured =
    !!(Deno.env.get("LOVABLE_API_KEY") ?? "").trim();

  const integrations = [
    {
      id: "upayments" as const,
      purpose: "payments" as const,
      enabled: upEnabled,
      configured: upConfigured,
      environment: upEnvironment,
      specialist_route: "/admin/settings/payments" as const,
    },
    {
      id: "resend" as const,
      purpose: "transactional_email" as const,
      configured: resendConfigured,
      sender_address: "info@jojoprompts.com" as const,
      domain: "jojoprompts.com" as const,
      specialist_route: "/admin/settings/email" as const,
    },
    {
      id: "cloudmersive" as const,
      purpose: "package_scanning" as const,
      configured: cmsConfigured,
      api_key_configured: cmsApiKeyConfigured,
      worker_secret_configured: cmsWorkerSecretConfigured,
      specialist_route: "/admin/trust/scans" as const,
    },
    {
      id: "lovable_ai" as const,
      purpose: "ai_studio" as const,
      configured: lovableConfigured,
      application_services: ["ai-studio-chat", "ai-studio-image"] as const,
      specialist_route: "/admin/publishing/new" as const,
    },
    {
      id: "jojoprompts_mcp" as const,
      purpose: "mcp_access" as const,
      configuration_state: "application_contract" as const,
      auth: "supabase_oauth" as const,
      service: "mcp" as const,
      contract_version: "0.1.0" as const,
      tools: ["list_my_prompts"] as const,
      endpoint: MCP_ENDPOINT,
      deployment_status: "not_checked" as const,
    },
  ];

  const body = {
    as_of: new Date().toISOString(),
    integrations,
    boundaries: {
      provider_health: "not_checked" as const,
      deployment_status: "not_checked" as const,
      secret_values: "never_exposed" as const,
    },
  };

  const res = jsonResponse(body, 200, origin);
  res.headers.set("Cache-Control", "no-store");
  return res;
});
