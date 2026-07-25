import { describe, expect, it } from "bun:test";
import {
  ALL_ROLES,
  ASSIGNABLE_ROLES,
  LEGACY_ROLES,
  formatUserCountFooter,
  groupRoleRowsByUser,
  isAssignableRole,
  isLastAdminRemovalBlocked,
  isRemovableRole,
  resolveAssignerLabel,
} from "./roles";
import type {
  ProfileLite,
  RoleRow,
} from "@/hooks/admin/v2/useAdminRolesTypes";

const rr = (over: Partial<RoleRow>): RoleRow => ({
  id: crypto.randomUUID(),
  user_id: "u1",
  role: "user",
  assigned_at: "2026-01-01T00:00:00Z",
  assigned_by: null,
  ...over,
});

const pr = (over: Partial<ProfileLite>): ProfileLite => ({
  id: "u1",
  first_name: null,
  last_name: null,
  username: null,
  email: null,
  ...over,
});

describe("roles: legacy jadmin", () => {
  it("jadmin is present in ALL_ROLES but not ASSIGNABLE_ROLES", () => {
    expect(ALL_ROLES).toContain("jadmin");
    expect(ASSIGNABLE_ROLES.includes("jadmin")).toBe(false);
    expect(LEGACY_ROLES).toEqual(["jadmin"]);
  });

  it("isAssignableRole rejects jadmin", () => {
    expect(isAssignableRole("jadmin")).toBe(false);
    expect(isAssignableRole("admin")).toBe(true);
    expect(isAssignableRole("prompter")).toBe(true);
    expect(isAssignableRole("user")).toBe(true);
  });

  it("isRemovableRole rejects jadmin (read-only on this page)", () => {
    expect(isRemovableRole("jadmin")).toBe(false);
    expect(isRemovableRole("admin")).toBe(true);
    expect(isRemovableRole("prompter")).toBe(true);
    expect(isRemovableRole("user")).toBe(true);
  });
});

describe("roles: isLastAdminRemovalBlocked", () => {
  it("blocks removing admin when exactly one admin remains", () => {
    expect(isLastAdminRemovalBlocked("admin", 1)).toBe(true);
  });
  it("blocks removing admin when count is 0 (defensive)", () => {
    expect(isLastAdminRemovalBlocked("admin", 0)).toBe(true);
  });
  it("allows admin removal when multiple admins exist", () => {
    expect(isLastAdminRemovalBlocked("admin", 2)).toBe(false);
    expect(isLastAdminRemovalBlocked("admin", 5)).toBe(false);
  });
  it("never blocks non-admin removals regardless of count", () => {
    expect(isLastAdminRemovalBlocked("prompter", 1)).toBe(false);
    expect(isLastAdminRemovalBlocked("user", 0)).toBe(false);
    expect(isLastAdminRemovalBlocked("jadmin", 1)).toBe(false);
  });
});

describe("roles: groupRoleRowsByUser", () => {
  it("preserves a user's complete role set across grouping", () => {
    const rows: RoleRow[] = [
      rr({ user_id: "u1", role: "admin" }),
      rr({ user_id: "u1", role: "prompter" }),
      rr({ user_id: "u1", role: "user" }),
      rr({ user_id: "u2", role: "user" }),
    ];
    const profiles = new Map<string, ProfileLite>([
      ["u1", pr({ id: "u1", email: "a@x" })],
      ["u2", pr({ id: "u2", email: "b@x" })],
    ]);
    const grouped = groupRoleRowsByUser(rows, profiles, ["u1", "u2"]);
    expect(grouped).toHaveLength(2);
    const u1 = grouped.find((g) => g.user_id === "u1")!;
    expect(u1.roles.map((r) => r.role).sort()).toEqual([
      "admin",
      "prompter",
      "user",
    ]);
    expect(u1.profile?.email).toBe("a@x");
    const u2 = grouped.find((g) => g.user_id === "u2")!;
    expect(u2.roles).toHaveLength(1);
  });

  it("preserves user order and includes users with no role rows", () => {
    const grouped = groupRoleRowsByUser(
      [],
      new Map([["u3", pr({ id: "u3", username: "x" })]]),
      ["u3"],
    );
    expect(grouped).toEqual([
      { user_id: "u3", profile: pr({ id: "u3", username: "x" }), roles: [] },
    ]);
  });

  it("drops role rows for users not on the current page", () => {
    const rows = [rr({ user_id: "ghost", role: "admin" })];
    const grouped = groupRoleRowsByUser(rows, new Map(), ["u1"]);
    expect(grouped[0].roles).toEqual([]);
  });
});

describe("roles: resolveAssignerLabel", () => {
  const profiles = new Map<string, ProfileLite>([
    [
      "assigner-1",
      pr({ id: "assigner-1", first_name: "Ada", last_name: "Lovelace" }),
    ],
    ["assigner-2", pr({ id: "assigner-2", username: "grace" })],
    ["assigner-3", pr({ id: "assigner-3", email: "op@x.com" })],
  ]);

  it("returns System / unavailable when assignedBy is null", () => {
    expect(resolveAssignerLabel(null, profiles)).toBe("System / unavailable");
    expect(resolveAssignerLabel(undefined, profiles)).toBe(
      "System / unavailable",
    );
  });
  it("returns System / unavailable when profile is not resolvable", () => {
    expect(resolveAssignerLabel("missing-uuid", profiles)).toBe(
      "System / unavailable",
    );
  });
  it("prefers full name, then username, then email", () => {
    expect(resolveAssignerLabel("assigner-1", profiles)).toBe("Ada Lovelace");
    expect(resolveAssignerLabel("assigner-2", profiles)).toBe("grace");
    expect(resolveAssignerLabel("assigner-3", profiles)).toBe("op@x.com");
  });
  it("never returns a raw UUID fragment as label", () => {
    const label = resolveAssignerLabel("assigner-1", profiles);
    expect(label.includes("assigner")).toBe(false);
  });
});

describe("roles: formatUserCountFooter", () => {
  it("uses `users` terminology (never `role rows`)", () => {
    const s = formatUserCountFooter(1234, 2, 10);
    expect(s).toContain("users");
    expect(s.includes("role rows")).toBe(false);
    expect(s).toContain("Page 2 / 10");
    expect(s).toContain("1,234");
  });
});
