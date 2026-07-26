// v2-admin-roles-settings-status
// Admin-only, read-only safe status for the Roles & permissions system.
// Returns aggregate counts (no user identity), a fixed role contract, and
// verification-boundary literals. Never returns names, emails, IDs, raw
// metadata, policy expressions, sessions, tokens, or row-level data.

import {
  corsHeadersFor, jsonResponse, methodGuard, requireAdmin, serviceClient,
} from "../_shared/v2Upayments.ts";

function isNonNegInt(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v)
    && Number.isInteger(v) && v >= 0;
}
function isBool(v: unknown): v is boolean { return typeof v === "boolean"; }
function isIsoOrNull(v: unknown): v is string | null {
  if (v === null) return true;
  if (typeof v !== "string") return false;
  const t = Date.parse(v);
  return Number.isFinite(t);
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

  const svc = serviceClient();
  const { data, error } = await svc.rpc(
    "v2_internal_admin_roles_settings_summary",
  );
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return jsonResponse({ error: "roles_status_unavailable" }, 500, origin);
  }

  const d = data as Record<string, unknown>;
  const rc = d.role_counts as Record<string, unknown> | undefined;

  const validAggregate =
    typeof d.as_of === "string" && Number.isFinite(Date.parse(d.as_of))
    && isNonNegInt(d.total_assignments)
    && isNonNegInt(d.users_with_roles)
    && rc && typeof rc === "object" && !Array.isArray(rc)
    && isNonNegInt(rc.admin)
    && isNonNegInt(rc.jadmin)
    && isNonNegInt(rc.prompter)
    && isNonNegInt(rc.user)
    && isNonNegInt(d.super_admin_count)
    && isNonNegInt(d.users_with_multiple_roles)
    && isNonNegInt(d.auth_users_total)
    && isNonNegInt(d.auth_users_without_roles)
    && isNonNegInt(d.profiles_total)
    && isNonNegInt(d.profiles_without_roles)
    && isIsoOrNull(d.last_assigned_at)
    && isBool(d.rls_enabled)
    && isBool(d.unique_user_role_constraint);

  if (!validAggregate) {
    return jsonResponse({ error: "roles_status_unavailable" }, 500, origin);
  }

  const totalAssignments = d.total_assignments as number;
  const adminCount = (rc as Record<string, unknown>).admin as number;
  const jadminCount = (rc as Record<string, unknown>).jadmin as number;
  const prompterCount = (rc as Record<string, unknown>).prompter as number;
  const userCount = (rc as Record<string, unknown>).user as number;
  const roleSum = adminCount + jadminCount + prompterCount + userCount;
  const authTotal = d.auth_users_total as number;
  const withRoles = d.users_with_roles as number;
  const withoutRoles = d.auth_users_without_roles as number;
  const superAdmins = d.super_admin_count as number;
  const multi = d.users_with_multiple_roles as number;

  if (
    roleSum !== totalAssignments
    || withRoles > totalAssignments
    || withRoles > authTotal
    || withoutRoles !== authTotal - withRoles
    || multi > withRoles
    || superAdmins > adminCount
  ) {
    return jsonResponse({ error: "roles_status_unavailable" }, 500, origin);
  }

  const body = {
    as_of: new Date(d.as_of as string).toISOString(),
    total_assignments: totalAssignments,
    users_with_roles: withRoles,
    role_counts: {
      admin: adminCount,
      jadmin: jadminCount,
      prompter: prompterCount,
      user: userCount,
    },
    super_admin_count: superAdmins,
    users_with_multiple_roles: multi,
    auth_users_total: authTotal,
    auth_users_without_roles: withoutRoles,
    profiles_total: d.profiles_total as number,
    profiles_without_roles: d.profiles_without_roles as number,
    last_assigned_at: d.last_assigned_at === null
      ? null
      : new Date(d.last_assigned_at as string).toISOString(),
    rls_enabled: d.rls_enabled as boolean,
    unique_user_role_constraint: d.unique_user_role_constraint as boolean,

    role_definitions: [
      {
        id: "user",
        label: "Customer",
        status: "active",
        default_on_signup: true,
        admin_v2: false,
        legacy_prompt_management: false,
        super_admin_supported: false,
      },
      {
        id: "prompter",
        label: "Catalog editor",
        status: "legacy_active",
        default_on_signup: false,
        admin_v2: false,
        legacy_prompt_management: true,
        super_admin_supported: false,
      },
      {
        id: "admin",
        label: "Administrator",
        status: "active",
        default_on_signup: false,
        admin_v2: true,
        legacy_prompt_management: true,
        super_admin_supported: true,
      },
      {
        id: "jadmin",
        label: "Legacy Jojo admin",
        status: "legacy_partial",
        default_on_signup: false,
        admin_v2: false,
        legacy_prompt_management: true,
        super_admin_supported: false,
      },
    ] as const,
    authorization_contract: {
      role_store: "public.user_roles",
      admin_v2_gate: "database_role_lookup",
      admin_v2_required_role: "admin",
      signup_default_role: "user",
      role_source: "database_not_user_metadata",
      legacy_admin_helper_roles: ["admin", "jadmin"],
      legacy_prompt_management_roles: ["admin", "prompter", "jadmin"],
    },
    boundaries: {
      role_mutation: "not_available",
      session_revocation: "not_checked",
      jwt_custom_claims: "not_used_for_admin_v2",
      policy_effectiveness: "not_tested_here",
      user_identity: "never_returned",
    },
  };

  const res = jsonResponse(body, 200, origin);
  res.headers.set("Cache-Control", "no-store");
  return res;
});
