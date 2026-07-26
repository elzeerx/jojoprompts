import { describe, expect, it } from "bun:test";
import {
  normalizeRolesSettingsStatus,
  ROLE_DEFINITIONS_EXPECTED,
  roleStatusLabel,
  roleStatusTone,
} from "./rolesSettings";

const CONTRACT = {
  role_store: "public.user_roles",
  admin_v2_gate: "database_role_lookup",
  admin_v2_required_role: "admin",
  signup_default_role: "user",
  role_source: "database_not_user_metadata",
  legacy_admin_helper_roles: ["admin", "jadmin"],
  legacy_prompt_management_roles: ["admin", "prompter", "jadmin"],
};

const BOUNDARIES = {
  role_mutation: "not_available",
  session_revocation: "not_checked",
  jwt_custom_claims: "not_used_for_admin_v2",
  policy_effectiveness: "not_tested_here",
  user_identity: "never_returned",
};

function liveShape() {
  return {
    as_of: "2026-07-26T12:34:56.000Z",
    total_assignments: 245,
    users_with_roles: 245,
    role_counts: { admin: 1, jadmin: 0, prompter: 2, user: 242 },
    super_admin_count: 1,
    users_with_multiple_roles: 0,
    auth_users_total: 247,
    auth_users_without_roles: 2,
    profiles_total: 243,
    profiles_without_roles: 0,
    last_assigned_at: "2026-07-24T12:04:12.117Z",
    rls_enabled: true,
    unique_user_role_constraint: true,
    role_definitions: JSON.parse(JSON.stringify(ROLE_DEFINITIONS_EXPECTED)),
    authorization_contract: { ...CONTRACT },
    boundaries: { ...BOUNDARIES },
  };
}

function emptyShape() {
  return {
    ...liveShape(),
    total_assignments: 0,
    users_with_roles: 0,
    role_counts: { admin: 0, jadmin: 0, prompter: 0, user: 0 },
    super_admin_count: 0,
    users_with_multiple_roles: 0,
    auth_users_without_roles: 247,
    last_assigned_at: null,
  };
}

describe("normalizeRolesSettingsStatus — accepts", () => {
  it("live shape", () => {
    const r = normalizeRolesSettingsStatus(liveShape());
    expect(r === null).toBe(false);
    expect(r!.total_assignments).toBe(245);
    expect(r!.role_counts.user).toBe(242);
    expect(r!.role_definitions.length).toBe(4);
  });
  it("empty shape (null last_assigned_at, zero counts)", () => {
    const r = normalizeRolesSettingsStatus(emptyShape());
    expect(r === null).toBe(false);
    expect(r!.last_assigned_at).toBeNull();
  });
});

describe("normalizeRolesSettingsStatus — fails closed", () => {
  it("rejects non-object", () => {
    expect(normalizeRolesSettingsStatus(null)).toBeNull();
    expect(normalizeRolesSettingsStatus("x")).toBeNull();
    expect(normalizeRolesSettingsStatus([])).toBeNull();
  });
  it("rejects unknown top-level key", () => {
    const b = { ...liveShape(), extra: 1 } as any;
    expect(normalizeRolesSettingsStatus(b)).toBeNull();
  });
  it("rejects missing top-level key", () => {
    const b: any = liveShape(); delete b.rls_enabled;
    expect(normalizeRolesSettingsStatus(b)).toBeNull();
  });
  it("rejects non-canonical timestamp", () => {
    const b = { ...liveShape(), as_of: "July 26, 2026" };
    expect(normalizeRolesSettingsStatus(b)).toBeNull();
  });
  it("rejects timezone-offset timestamp", () => {
    const b = { ...liveShape(), as_of: "2026-07-26T12:34:56+00:00" };
    expect(normalizeRolesSettingsStatus(b)).toBeNull();
  });
  it("rejects negative count", () => {
    const b = { ...liveShape(), total_assignments: -1 };
    expect(normalizeRolesSettingsStatus(b)).toBeNull();
  });
  it("rejects role-count sum mismatch", () => {
    const b = { ...liveShape(), total_assignments: 244 };
    expect(normalizeRolesSettingsStatus(b)).toBeNull();
  });
  it("rejects users_with_roles > total_assignments", () => {
    const b = liveShape(); b.users_with_roles = 246;
    expect(normalizeRolesSettingsStatus(b)).toBeNull();
  });
  it("rejects bad without-roles arithmetic", () => {
    const b = liveShape(); b.auth_users_without_roles = 3;
    expect(normalizeRolesSettingsStatus(b)).toBeNull();
  });
  it("rejects super_admin_count > admin count", () => {
    const b = liveShape(); b.super_admin_count = 2;
    expect(normalizeRolesSettingsStatus(b)).toBeNull();
  });
  it("rejects users_with_multiple_roles > users_with_roles", () => {
    const b = liveShape(); b.users_with_multiple_roles = 300;
    expect(normalizeRolesSettingsStatus(b)).toBeNull();
  });
  it("rejects wrong role_definitions order", () => {
    const b = liveShape();
    b.role_definitions = [
      ROLE_DEFINITIONS_EXPECTED[1],
      ROLE_DEFINITIONS_EXPECTED[0],
      ROLE_DEFINITIONS_EXPECTED[2],
      ROLE_DEFINITIONS_EXPECTED[3],
    ];
    expect(normalizeRolesSettingsStatus(b)).toBeNull();
  });
  it("rejects wrong role_definitions literal", () => {
    const b = liveShape();
    const rds = JSON.parse(JSON.stringify(ROLE_DEFINITIONS_EXPECTED));
    rds[2].label = "Root";
    b.role_definitions = rds;
    expect(normalizeRolesSettingsStatus(b)).toBeNull();
  });
  it("rejects extra role_counts key", () => {
    const b: any = liveShape();
    b.role_counts = { ...b.role_counts, root: 1 };
    b.total_assignments = 246;
    expect(normalizeRolesSettingsStatus(b)).toBeNull();
  });
  it("rejects wrong contract literal", () => {
    const b: any = liveShape();
    b.authorization_contract = { ...CONTRACT, admin_v2_required_role: "jadmin" };
    expect(normalizeRolesSettingsStatus(b)).toBeNull();
  });
  it("rejects wrong boundaries literal", () => {
    const b: any = liveShape();
    b.boundaries = { ...BOUNDARIES, role_mutation: "available" };
    expect(normalizeRolesSettingsStatus(b)).toBeNull();
  });
  it("rejects secret-like key at top level", () => {
    const b: any = { ...liveShape(), api_key: "x" };
    expect(normalizeRolesSettingsStatus(b)).toBeNull();
  });
  it("rejects identity key deep inside", () => {
    const b: any = liveShape();
    b.role_counts = { ...b.role_counts, email: 0 };
    expect(normalizeRolesSettingsStatus(b)).toBeNull();
  });
  it("rejects non-boolean rls_enabled", () => {
    const b: any = liveShape(); b.rls_enabled = "true";
    expect(normalizeRolesSettingsStatus(b)).toBeNull();
  });
});

describe("presentation helpers", () => {
  it("tone/label per status", () => {
    expect(roleStatusTone("active")).toBe("ok");
    expect(roleStatusTone("legacy_active")).toBe("warn");
    expect(roleStatusTone("legacy_partial")).toBe("danger");
    expect(roleStatusLabel("active")).toBe("Active");
    expect(roleStatusLabel("legacy_active")).toBe("Legacy · active");
    expect(roleStatusLabel("legacy_partial")).toBe("Legacy · partial");
  });
});
