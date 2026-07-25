/**
 * Pure helpers for the Admin V2 Roles page.
 * Extracted for focused unit testing (no Supabase / React dependencies).
 */

import type { AppRole, ProfileLite, RoleRow, RoleUserRow } from "@/hooks/admin/v2/useAdminRolesTypes";

export const ASSIGNABLE_ROLES: AppRole[] = ["admin", "prompter", "user"];
export const ALL_ROLES: AppRole[] = ["admin", "jadmin", "prompter", "user"];
export const LEGACY_ROLES: AppRole[] = ["jadmin"];

/** `jadmin` is legacy: never assignable from this page. */
export function isAssignableRole(role: AppRole): boolean {
  return ASSIGNABLE_ROLES.includes(role) && !LEGACY_ROLES.includes(role);
}

/** `jadmin` is legacy read-only: never removable from this page. */
export function isRemovableRole(role: AppRole): boolean {
  return !LEGACY_ROLES.includes(role);
}

/**
 * The last-admin removal predicate for the UI. Removing an admin role
 * is disabled only when exactly one admin remains project-wide.
 * The server trigger enforces the same rule authoritatively.
 */
export function isLastAdminRemovalBlocked(
  role: AppRole,
  adminCount: number,
): boolean {
  return role === "admin" && adminCount <= 1;
}

/** Group role rows by user_id and attach the resolved profile (or null). */
export function groupRoleRowsByUser(
  roleRows: RoleRow[],
  profilesById: Map<string, ProfileLite>,
  orderedUserIds: string[],
): RoleUserRow[] {
  const grouped = new Map<string, RoleUserRow>();
  for (const id of orderedUserIds) {
    grouped.set(id, {
      user_id: id,
      profile: profilesById.get(id) ?? null,
      roles: [],
    });
  }
  for (const r of roleRows) {
    const entry = grouped.get(r.user_id);
    if (entry) entry.roles.push(r);
  }
  return orderedUserIds
    .map((id) => grouped.get(id))
    .filter((v): v is RoleUserRow => Boolean(v));
}

/**
 * Resolve the human label for an `assigned_by` UUID. Falls back to
 * `System / unavailable` when we can't resolve a real profile.
 * Never renders a raw UUID fragment as the primary label.
 */
export function resolveAssignerLabel(
  assignedBy: string | null | undefined,
  profilesById: Map<string, ProfileLite>,
): string {
  if (!assignedBy) return "System / unavailable";
  const p = profilesById.get(assignedBy);
  if (!p) return "System / unavailable";
  const full = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return full || p.username || p.email || "System / unavailable";
}

/**
 * Footer terminology helper — page counts unique users, not role rows.
 * Kept as a helper so the label stays consistent everywhere.
 */
export function formatUserCountFooter(
  totalUsers: number,
  page: number,
  totalPages: number,
): string {
  return `${totalUsers.toLocaleString()} users · Page ${page} / ${totalPages}`;
}
