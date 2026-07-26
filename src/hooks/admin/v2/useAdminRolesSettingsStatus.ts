import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  normalizeRolesSettingsStatus,
  type RolesSettingsStatus,
} from "@/lib/v2/admin/rolesSettings";

export const adminRolesSettingsKeys = {
  status: () => ["admin", "v2", "settings", "roles", "status"] as const,
};

export function useAdminRolesSettingsStatus() {
  return useQuery({
    queryKey: adminRolesSettingsKeys.status(),
    queryFn: async (): Promise<RolesSettingsStatus> => {
      const { data, error } = await supabase.functions.invoke(
        "v2-admin-roles-settings-status",
        { body: {} },
      );
      if (error) throw new Error("Roles status is temporarily unavailable.");
      const normalized = normalizeRolesSettingsStatus(data);
      if (!normalized) {
        throw new Error("Roles status is temporarily unavailable.");
      }
      return normalized;
    },
    staleTime: 30_000,
    retry: 1,
  });
}
