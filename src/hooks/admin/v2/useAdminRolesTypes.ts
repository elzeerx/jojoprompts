import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

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
  assignerProfilesById: Map<string, ProfileLite>;
}

export interface RoleListParams {
  search: string;
  roleFilter: AppRole | "all";
  page: number;
  pageSize: number;
}
