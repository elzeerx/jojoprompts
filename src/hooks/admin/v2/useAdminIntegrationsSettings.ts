import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  normalizeIntegrationsSettingsStatus,
  type IntegrationsSettingsStatus,
} from "@/lib/v2/admin/integrationsSettings";

export function useAdminIntegrationsSettingsStatus() {
  return useQuery<IntegrationsSettingsStatus>({
    queryKey: ["admin", "v2", "integrations-settings-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "v2-admin-integrations-settings-status",
        { body: {} },
      );
      if (error) throw new Error("integrations_status_unavailable");
      const normalized = normalizeIntegrationsSettingsStatus(data);
      if (!normalized) throw new Error("integrations_status_unavailable");
      return normalized;
    },
    staleTime: 30_000,
    retry: 1,
  });
}
