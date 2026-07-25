import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ASSIGNABLE_ROLES,
  LEGACY_ROLES,
  groupRoleRowsByUser,
} from "@/lib/v2/admin/roles";
import type {
  AppRole,
  ProfileLite,
  RoleListParams,
  RoleListResult,
  RoleRow,
} from "@/hooks/admin/v2/useAdminRolesTypes";

export type {
  AppRole,
  ProfileLite,
  RoleListParams,
  RoleListResult,
  RoleRow,
  RoleUserRow,
} from "@/hooks/admin/v2/useAdminRolesTypes";
export {
  ASSIGNABLE_ROLES,
  ALL_ROLES,
  LEGACY_ROLES,
} from "@/lib/v2/admin/roles";

export const adminRolesKeys = {
  list: (p: RoleListParams) => ["admin", "v2", "roles", "list", p] as const,
  counts: () => ["admin", "v2", "roles", "counts"] as const,
};

function escapeLike(v: string): string {
  return v.replace(/[%_]/g, "\\$&");
}

/**
 * Roles page data loader — pagination and totals are based on **unique users**,
 * not role rows, so a single user's roles never span multiple pages.
 *
 * Strategy:
 * 1. Determine the candidate user-id universe (all users, or users holding the
 *    selected role).
 * 2. Query `profiles` restricted to that universe with search + exact count +
 *    `.range` to get the current page of unique users.
 * 3. Fetch the complete `user_roles` set for just those page user ids so each
 *    displayed user shows every role they hold.
 * 4. Resolve `assigned_by` UUIDs into a bounded profile lookup for display.
 */
export function useAdminRoleList(params: RoleListParams) {
  return useQuery({
    queryKey: adminRolesKeys.list(params),
    queryFn: async (): Promise<RoleListResult> => {
      const from = (params.page - 1) * params.pageSize;
      const to = from + params.pageSize - 1;
      const trimmed = params.search.trim();
      const like = trimmed ? `%${escapeLike(trimmed)}%` : null;

      // Step 1 — restrict candidate user ids when a role filter is set.
      let restrictIds: string[] | null = null;
      if (params.roleFilter !== "all") {
        const { data: idRows, error: idErr } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", params.roleFilter);
        if (idErr) throw idErr;
        restrictIds = Array.from(
          new Set((idRows ?? []).map((r) => r.user_id)),
        );
        if (restrictIds.length === 0) {
          return { rows: [], total: 0, assignerProfilesById: new Map() };
        }
      }

      // Step 2 — paginate unique users via `profiles`.
      let profileQuery = supabase
        .from("profiles")
        .select("id, first_name, last_name, username, email", {
          count: "exact",
        })
        .order("email", { ascending: true, nullsFirst: false })
        .range(from, to);

      if (restrictIds && restrictIds.length > 0) {
        profileQuery = profileQuery.in("id", restrictIds);
      }
      if (like) {
        profileQuery = profileQuery.or(
          [
            `email.ilike.${like}`,
            `username.ilike.${like}`,
            `first_name.ilike.${like}`,
            `last_name.ilike.${like}`,
          ].join(","),
        );
      }

      const {
        data: profileRows,
        error: profileError,
        count,
      } = await profileQuery;
      if (profileError) throw profileError;

      const pageUserIds = (profileRows ?? []).map((p) => p.id);
      if (pageUserIds.length === 0) {
        return {
          rows: [],
          total: count ?? 0,
          assignerProfilesById: new Map(),
        };
      }

      const profilesById = new Map<string, ProfileLite>();
      for (const p of profileRows ?? []) {
        profilesById.set(p.id, p as ProfileLite);
      }

      // Step 3 — full role set for exactly those page users.
      const { data: allRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("id, user_id, role, assigned_at, assigned_by")
        .in("user_id", pageUserIds);
      if (rolesError) throw rolesError;

      const roleRows = (allRoles ?? []) as RoleRow[];

      // Step 4 — enrich assigner identities via a bounded lookup.
      const assignerIds = Array.from(
        new Set(
          roleRows
            .map((r) => r.assigned_by)
            .filter((v): v is string => Boolean(v)),
        ),
      );
      const assignerProfilesById = new Map<string, ProfileLite>();
      if (assignerIds.length > 0) {
        const { data: assigners, error: assignerErr } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, username, email")
          .in("id", assignerIds);
        if (assignerErr) throw assignerErr;
        for (const p of assigners ?? []) {
          assignerProfilesById.set(p.id, p as ProfileLite);
        }
      }

      return {
        rows: groupRoleRowsByUser(roleRows, profilesById, pageUserIds),
        total: count ?? 0,
        assignerProfilesById,
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
      const { data, error } = await supabase.from("user_roles").select("role");
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
      if (LEGACY_ROLES.includes(role) || !ASSIGNABLE_ROLES.includes(role)) {
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
      if (LEGACY_ROLES.includes(role)) {
        throw new Error(
          "Legacy jadmin role cannot be removed from this page.",
        );
      }
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
