// Strict fail-closed normalizer for the Admin V2 Roles & permissions
// settings response. Rejects any unknown key, secret-like key, user
// identity field, non-canonical ISO timestamp, wrong literal, wrong order,
// impossible count relationship, or malformed contract.
//
// All fields returned by the Edge Function are safe aggregates; this
// module additionally guarantees no attacker-influenced value can flow
// into the UI.

export type StatusTone = "ok" | "warn" | "danger" | "info";

export const ROLE_ORDER = ["user", "prompter", "admin", "jadmin"] as const;
export type AppRoleId = (typeof ROLE_ORDER)[number];

export const ROLE_DEFINITIONS_EXPECTED: readonly RoleDefinition[] = [
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
];

export type RoleDefinition = {
  id: AppRoleId;
  label: string;
  status: "active" | "legacy_active" | "legacy_partial";
  default_on_signup: boolean;
  admin_v2: boolean;
  legacy_prompt_management: boolean;
  super_admin_supported: boolean;
};

export type AuthorizationContract = {
  role_store: "public.user_roles";
  admin_v2_gate: "database_role_lookup";
  admin_v2_required_role: "admin";
  signup_default_role: "user";
  role_source: "database_not_user_metadata";
  legacy_admin_helper_roles: readonly ["admin", "jadmin"];
  legacy_prompt_management_roles: readonly ["admin", "prompter", "jadmin"];
};

export type RolesBoundaries = {
  role_mutation: "not_available";
  session_revocation: "not_checked";
  jwt_custom_claims: "not_used_for_admin_v2";
  policy_effectiveness: "not_tested_here";
  user_identity: "never_returned";
};

export type RolesSettingsStatus = {
  as_of: string;
  total_assignments: number;
  users_with_roles: number;
  role_counts: Record<AppRoleId, number>;
  super_admin_count: number;
  users_with_multiple_roles: number;
  auth_users_total: number;
  auth_users_without_roles: number;
  profiles_total: number;
  profiles_without_roles: number;
  last_assigned_at: string | null;
  rls_enabled: boolean;
  unique_user_role_constraint: boolean;
  role_definitions: readonly RoleDefinition[];
  authorization_contract: AuthorizationContract;
  boundaries: RolesBoundaries;
};

// --- validators ---

const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
function isCanonicalIso(v: unknown): v is string {
  if (typeof v !== "string" || !ISO_UTC_RE.test(v)) return false;
  const t = Date.parse(v);
  if (!Number.isFinite(t)) return false;
  return new Date(t).toISOString() === v;
}
function isCanonicalIsoOrNull(v: unknown): v is string | null {
  return v === null || isCanonicalIso(v);
}
function isNonNegInt(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v)
    && Number.isInteger(v) && v >= 0;
}
function isBool(v: unknown): v is boolean { return typeof v === "boolean"; }

// Note: no separate deep secret/identity scanner is needed. Every nested
// object below is validated with an explicit key allowlist plus literal
// checks, so any unexpected key (secret-shaped or otherwise) is rejected
// where it would appear.

const ROLE_DEF_ALLOWED_KEYS = new Set<keyof RoleDefinition>([
  "id", "label", "status", "default_on_signup", "admin_v2",
  "legacy_prompt_management", "super_admin_supported",
]);

function validateRoleDefinitions(v: unknown): readonly RoleDefinition[] | null {
  if (!Array.isArray(v)) return null;
  if (v.length !== ROLE_DEFINITIONS_EXPECTED.length) return null;
  for (let i = 0; i < v.length; i++) {
    const item = v[i];
    const expected = ROLE_DEFINITIONS_EXPECTED[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const keys = Object.keys(item as Record<string, unknown>);
    if (keys.length !== ROLE_DEF_ALLOWED_KEYS.size) return null;
    for (const k of keys) {
      if (!ROLE_DEF_ALLOWED_KEYS.has(k as keyof RoleDefinition)) return null;
    }
    const o = item as Record<string, unknown>;
    if (o.id !== expected.id) return null;
    if (o.label !== expected.label) return null;
    if (o.status !== expected.status) return null;
    if (o.default_on_signup !== expected.default_on_signup) return null;
    if (o.admin_v2 !== expected.admin_v2) return null;
    if (o.legacy_prompt_management !== expected.legacy_prompt_management) return null;
    if (o.super_admin_supported !== expected.super_admin_supported) return null;
  }
  return ROLE_DEFINITIONS_EXPECTED;
}

const CONTRACT_ALLOWED_KEYS = new Set<string>([
  "role_store", "admin_v2_gate", "admin_v2_required_role",
  "signup_default_role", "role_source",
  "legacy_admin_helper_roles", "legacy_prompt_management_roles",
]);
function validateAuthorizationContract(v: unknown): AuthorizationContract | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length !== CONTRACT_ALLOWED_KEYS.size) return null;
  for (const k of keys) if (!CONTRACT_ALLOWED_KEYS.has(k)) return null;
  if (o.role_store !== "public.user_roles") return null;
  if (o.admin_v2_gate !== "database_role_lookup") return null;
  if (o.admin_v2_required_role !== "admin") return null;
  if (o.signup_default_role !== "user") return null;
  if (o.role_source !== "database_not_user_metadata") return null;
  if (!Array.isArray(o.legacy_admin_helper_roles)) return null;
  if (o.legacy_admin_helper_roles.length !== 2) return null;
  if (o.legacy_admin_helper_roles[0] !== "admin"
      || o.legacy_admin_helper_roles[1] !== "jadmin") return null;
  if (!Array.isArray(o.legacy_prompt_management_roles)) return null;
  if (o.legacy_prompt_management_roles.length !== 3) return null;
  if (o.legacy_prompt_management_roles[0] !== "admin"
      || o.legacy_prompt_management_roles[1] !== "prompter"
      || o.legacy_prompt_management_roles[2] !== "jadmin") return null;
  return {
    role_store: "public.user_roles",
    admin_v2_gate: "database_role_lookup",
    admin_v2_required_role: "admin",
    signup_default_role: "user",
    role_source: "database_not_user_metadata",
    legacy_admin_helper_roles: ["admin", "jadmin"],
    legacy_prompt_management_roles: ["admin", "prompter", "jadmin"],
  };
}

const BOUNDARIES_ALLOWED_KEYS = new Set<string>([
  "role_mutation", "session_revocation", "jwt_custom_claims",
  "policy_effectiveness", "user_identity",
]);
function validateBoundaries(v: unknown): RolesBoundaries | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length !== BOUNDARIES_ALLOWED_KEYS.size) return null;
  for (const k of keys) if (!BOUNDARIES_ALLOWED_KEYS.has(k)) return null;
  if (o.role_mutation !== "not_available") return null;
  if (o.session_revocation !== "not_checked") return null;
  if (o.jwt_custom_claims !== "not_used_for_admin_v2") return null;
  if (o.policy_effectiveness !== "not_tested_here") return null;
  if (o.user_identity !== "never_returned") return null;
  return {
    role_mutation: "not_available",
    session_revocation: "not_checked",
    jwt_custom_claims: "not_used_for_admin_v2",
    policy_effectiveness: "not_tested_here",
    user_identity: "never_returned",
  };
}

const TOP_LEVEL_ALLOWED_KEYS = new Set<string>([
  "as_of", "total_assignments", "users_with_roles", "role_counts",
  "super_admin_count", "users_with_multiple_roles",
  "auth_users_total", "auth_users_without_roles",
  "profiles_total", "profiles_without_roles",
  "last_assigned_at", "rls_enabled", "unique_user_role_constraint",
  "role_definitions", "authorization_contract", "boundaries",
]);
const ROLE_COUNT_KEYS = new Set<AppRoleId>(["admin", "jadmin", "prompter", "user"]);

export function normalizeRolesSettingsStatus(
  raw: unknown,
): RolesSettingsStatus | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const o = raw as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length !== TOP_LEVEL_ALLOWED_KEYS.size) return null;
  for (const k of keys) if (!TOP_LEVEL_ALLOWED_KEYS.has(k)) return null;

  if (!isCanonicalIso(o.as_of)) return null;
  if (!isNonNegInt(o.total_assignments)) return null;
  if (!isNonNegInt(o.users_with_roles)) return null;
  if (!isNonNegInt(o.super_admin_count)) return null;
  if (!isNonNegInt(o.users_with_multiple_roles)) return null;
  if (!isNonNegInt(o.auth_users_total)) return null;
  if (!isNonNegInt(o.auth_users_without_roles)) return null;
  if (!isNonNegInt(o.profiles_total)) return null;
  if (!isNonNegInt(o.profiles_without_roles)) return null;
  if (!isCanonicalIsoOrNull(o.last_assigned_at)) return null;
  if (!isBool(o.rls_enabled)) return null;
  if (!isBool(o.unique_user_role_constraint)) return null;

  const rc = o.role_counts;
  if (!rc || typeof rc !== "object" || Array.isArray(rc)) return null;
  const rcKeys = Object.keys(rc as Record<string, unknown>);
  if (rcKeys.length !== ROLE_COUNT_KEYS.size) return null;
  for (const k of rcKeys) if (!ROLE_COUNT_KEYS.has(k as AppRoleId)) return null;
  const rcObj = rc as Record<string, unknown>;
  for (const rid of ROLE_COUNT_KEYS) {
    if (!isNonNegInt(rcObj[rid])) return null;
  }
  const roleCounts: Record<AppRoleId, number> = {
    admin: rcObj.admin as number,
    jadmin: rcObj.jadmin as number,
    prompter: rcObj.prompter as number,
    user: rcObj.user as number,
  };
  const roleSum = roleCounts.admin + roleCounts.jadmin
    + roleCounts.prompter + roleCounts.user;
  if (roleSum !== (o.total_assignments as number)) return null;

  const withRoles = o.users_with_roles as number;
  const total = o.total_assignments as number;
  const authTotal = o.auth_users_total as number;
  const withoutRoles = o.auth_users_without_roles as number;
  if (withRoles > total) return null;
  if (withRoles > authTotal) return null;
  if (withoutRoles !== authTotal - withRoles) return null;
  if ((o.users_with_multiple_roles as number) > withRoles) return null;
  if ((o.super_admin_count as number) > roleCounts.admin) return null;

  const roleDefinitions = validateRoleDefinitions(o.role_definitions);
  if (!roleDefinitions) return null;
  const contract = validateAuthorizationContract(o.authorization_contract);
  if (!contract) return null;
  const boundaries = validateBoundaries(o.boundaries);
  if (!boundaries) return null;

  return {
    as_of: o.as_of as string,
    total_assignments: total,
    users_with_roles: withRoles,
    role_counts: roleCounts,
    super_admin_count: o.super_admin_count as number,
    users_with_multiple_roles: o.users_with_multiple_roles as number,
    auth_users_total: authTotal,
    auth_users_without_roles: withoutRoles,
    profiles_total: o.profiles_total as number,
    profiles_without_roles: o.profiles_without_roles as number,
    last_assigned_at: o.last_assigned_at as string | null,
    rls_enabled: o.rls_enabled as boolean,
    unique_user_role_constraint: o.unique_user_role_constraint as boolean,
    role_definitions: roleDefinitions,
    authorization_contract: contract,
    boundaries,
  };
}

// --- presentation helpers ---

export function roleStatusTone(s: RoleDefinition["status"]): StatusTone {
  switch (s) {
    case "active": return "ok";
    case "legacy_active": return "warn";
    case "legacy_partial": return "danger";
  }
}

export function roleStatusLabel(s: RoleDefinition["status"]): string {
  switch (s) {
    case "active": return "Active";
    case "legacy_active": return "Legacy · active";
    case "legacy_partial": return "Legacy · partial";
  }
}

export const ROLES_NAV_LINKS: readonly {
  label: string; to: string; description: string;
}[] = [
  {
    label: "Users",
    to: "/admin/people?tab=users",
    description: "Assign roles and manage individual accounts.",
  },
  {
    label: "Admin activity log",
    to: "/admin/operations?tab=admin-activity",
    description: "Audit trail of administrator actions.",
  },
  {
    label: "Security events",
    to: "/admin/operations?tab=security-events",
    description: "Suspicious authentication and access events.",
  },
];

export function jadminMismatchNotice(): string {
  return (
    "The jadmin role is a legacy partial-admin role. It is accepted by "
    + "legacy prompt-management and legacy is_admin checks, but the Admin V2 "
    + "authorization gate accepts admin only. Do not assign jadmin to new users."
  );
}
