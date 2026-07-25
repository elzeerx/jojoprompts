import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

/** Roles assignable from the Roles page. `jadmin` is legacy/read-only. */
export const ASSIGNABLE_ROLES: AppRole[] = ["admin", "prompter", "user"];
export const ALL_ROLES: AppRole[] = ["admin", "jadmin", "prompter", "user"];
export const LEGACY_ROLES: AppRole[] = ["jadmin"];

export interface RoleRow {
  id: string;
  user_id: string;
  role: AppRole;
  assigned_at: string | null;
  assigned_by: string | null;
}

export interface ProfileLite {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  email: string | null;
}

export interface RoleUserRow {
  user_id: string;
  profile: ProfileLite | null;
  roles: RoleRow[];
}

export interface RoleListResult {
  rows: RoleUserRow[];
  total: number;
  counts: Record<AppRole, number>;
}

export const adminRolesKeys = {
  list: (p: RoleListParams) => ["admin", "v2", "roles", "list", p] as const,
  counts: () => ["admin", "v2", "roles", "counts"] as const,
  profilesByIds: (ids: string[]) =>
    ["admin", "v2", "roles", "profiles", [...ids].sort()] as const,
};

export interface RoleListParams {
  search: string;
  roleFilter: AppRole | "all";
  page: number;
  pageSize: number;
}

/**
 * Load role rows joined to lightweight profile data.
 *
 * Strategy: run two bounded queries — role rows first (limited by pageSize),
 * then a single profile lookup for the collected user ids. This avoids
 * unbounded profile scans and preserves the paginated contract.
 */
export function useAdminRoleList(params: RoleListParams) {
  return useQuery({
    queryKey: adminRolesKeys.list(params),
    queryFn: async (): Promise<RoleListResult> => {
      const from = (params.page - 1) * params.pageSize;
      const to = from + params.pageSize - 1;

      // Step 1 — role rows scoped by role filter.
      let roleQuery = supabase
        .from("user_roles")
        .select("id, user_id, role, assigned_at, assigned_by", {
          count: "exact",
        })
        .order("assigned_at", { ascending: false, nullsFirst: false })
        .range(from, to);

      if (params.roleFilter !== "all") {
        roleQuery = roleQuery.eq("role", params.roleFilter);
      }

      const { data: roleRows, error: roleError, count } = await roleQuery;
      if (roleError) throw roleError;

      const userIds = Array.from(
        new Set((roleRows ?? []).map((r) => r.user_id)),
      );

      // Step 2 — profile lookup, optionally filtered by search.
      let profileQuery = supabase
        .from("profiles")
        .select("id, first_name, last_name, username, email");

      if (userIds.length > 0) profileQuery = profileQuery.in("id", userIds);

      const trimmed = params.search.trim();
      if (trimmed) {
        const like = `%${trimmed.replace(/[%_]/g, "\\$&")}%`;
        profileQuery = profileQuery.or(
          [
            `email.ilike.${like}`,
            `username.ilike.${like}`,
            `first_name.ilike.${like}`,
            `last_name.ilike.${like}`,
          ].join(","),
        );
      }

      const { data: profileRows, error: profileError } =
        userIds.length > 0 ? await profileQuery : { data: [], error: null };
      if (profileError) throw profileError;

      const profileById = new Map<string, ProfileLite>();
      for (const p of profileRows ?? []) {
        profileById.set(p.id, p as ProfileLite);
      }

      // Group role rows by user; when the user typed a search, drop users
      // that had no matching profile.
      const grouped = new Map<string, RoleUserRow>();
      for (const r of (roleRows ?? []) as RoleRow[]) {
        const profile = profileById.get(r.user_id) ?? null;
        if (trimmed && !profile) continue;
        const existing = grouped.get(r.user_id);
        if (existing) {
          existing.roles.push(r);
        } else {
          grouped.set(r.user_id, {
            user_id: r.user_id,
            profile,
            roles: [r],
          });
        }
      }

      return {
        rows: Array.from(grouped.values()),
        total: count ?? 0,
        counts: {} as Record<AppRole, number>,
      };
    },
    staleTime: 30_000,
  });
}

/** Global role counts across every user_roles row (unpaginated summary). */
export function useAdminRoleCounts() {
  return useQuery({
    queryKey: adminRolesKeys.counts(),
    queryFn: async (): Promise<Record<AppRole, number>> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role");
      if (error) throw error;
      const counts: Record<AppRole, number> = {
        admin: 0,
        jadmin: 0,
        prompter: 0,
        user: 0,
      };
      for (const r of data ?? []) counts[r.role as AppRole] += 1;
      return counts;
    },
    staleTime: 30_000,
  });
}

/** Assign a role to a user; idempotent on (user_id, role). */
export function useAssignRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      role,
    }: {
      userId: string;
      role: AppRole;
    }) => {
      if (LEGACY_ROLES.includes(role)) {
        throw new Error(
          "Legacy jadmin role cannot be assigned from this page.",
        );
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { error } = await supabase
        .from("user_roles")
        .upsert(
          { user_id: userId, role, assigned_by: user.id },
          { onConflict: "user_id,role", ignoreDuplicates: true },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "v2", "roles"] });
    },
  });
}

/** Remove a role. Server trigger prevents removing the final admin. */
export function useRemoveRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      role,
    }: {
      userId: string;
      role: AppRole;
    }) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "v2", "roles"] });
    },
  });
}

/** Format a role list into a stable string for display. */
export function formatRolesLabel(roles: AppRole[]): string {
  return roles.slice().sort().join(", ") || "—";
}
