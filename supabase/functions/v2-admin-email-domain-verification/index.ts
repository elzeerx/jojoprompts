// v2-admin-email-domain-verification
//
// Admin-only, read-only Resend sending-domain verification probe.
//
// Purpose: the 2026-08-02 password-recovery 500 was caused by Supabase Auth
// SMTP sending from `noreply.jojoprompts.com`, which is NOT a verified Resend
// sending domain. This endpoint reports, without ever returning secrets, which
// domains are verified in the Resend account so the auth sender can be
// verified or replaced with a verified identity.
//
// Guarantees:
// - POST only, admin role required.
// - Never returns the API key, key fragments, lengths, or raw provider bodies.
// - Never mutates anything in Resend or the database.

import {
  corsHeadersFor, jsonResponse, methodGuard, requireAdmin,
} from "../_shared/v2Upayments.ts";

// Domains this project must be able to send from.
const TRANSACTIONAL_DOMAIN = "jojoprompts.com";
// 2026-08-03: Auth SMTP sender moved to noreply@jojoprompts.com (verified parent
// domain). The previous subdomain sender was never verified in Resend.
const AUTH_SENDER_DOMAIN = "jojoprompts.com";
const LEGACY_AUTH_SENDER_DOMAIN = "noreply.jojoprompts.com";

type DomainStatus = "verified" | "pending" | "failed" | "not_found" | "unknown";

function normalizeStatus(value: unknown): DomainStatus {
  if (typeof value !== "string") return "unknown";
  const v = value.trim().toLowerCase();
  if (v === "verified") return "verified";
  if (v === "pending" || v === "not_started" || v === "temporary_failure") {
    return "pending";
  }
  if (v === "failure" || v === "failed") return "failed";
  return "unknown";
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeadersFor(origin) });
  }
  const g = methodGuard(req, "POST");
  if (g) return g;

  const admin = await requireAdmin(req);
  if ("error" in admin) return admin.error;

  const apiKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
  if (!apiKey) {
    const res = jsonResponse({
      provider: "resend",
      checked: false,
      error: "provider_api_key_missing",
      domains: [],
    }, 200, origin);
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  let list: unknown = null;
  let reachable = true;
  try {
    const r = await fetch("https://api.resend.com/domains", {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!r.ok) {
      reachable = false;
    } else {
      list = await r.json();
    }
  } catch {
    reachable = false;
  }

  if (!reachable) {
    const res = jsonResponse({
      provider: "resend",
      checked: false,
      error: "provider_unreachable",
      domains: [],
    }, 200, origin);
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  const raw = (list && typeof list === "object" && Array.isArray((list as Record<string, unknown>).data))
    ? (list as Record<string, unknown>).data as unknown[]
    : [];

  const byName = new Map<string, DomainStatus>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const rec = entry as Record<string, unknown>;
    const name = typeof rec.name === "string" ? rec.name.trim().toLowerCase() : "";
    if (!name) continue;
    byName.set(name, normalizeStatus(rec.status));
  }

  const domains = [TRANSACTIONAL_DOMAIN, AUTH_SENDER_DOMAIN].map((name) => ({
    domain: name,
    role: name === TRANSACTIONAL_DOMAIN ? "transactional" as const : "auth_sender" as const,
    status: byName.get(name) ?? "not_found" as DomainStatus,
  }));

  const authOk = domains.some((d) => d.role === "auth_sender" && d.status === "verified");
  const transactionalOk = domains.some(
    (d) => d.role === "transactional" && d.status === "verified",
  );

  const body = {
    provider: "resend" as const,
    checked: true,
    domains,
    auth_sender_ready: authOk,
    transactional_sender_ready: transactionalOk,
    // When the auth sender domain is not verified but the transactional one is,
    // the safe unblock is to move Supabase Auth SMTP to the verified identity.
    recommended_auth_sender: authOk
      ? `noreply@${AUTH_SENDER_DOMAIN}`
      : (transactionalOk ? `noreply@${TRANSACTIONAL_DOMAIN}` : null),
    total_domains_in_account: byName.size,
  };

  const res = jsonResponse(body, 200, origin);
  res.headers.set("Cache-Control", "no-store");
  return res;
});
