import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  normalizeStorageSettingsStatus,
  type StorageSettingsStatus,
} from "@/lib/v2/admin/storageSettings";

export function useAdminStorageSettingsStatus() {
  return useQuery<StorageSettingsStatus>({
    queryKey: ["admin", "v2", "storage-settings-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "v2-admin-storage-settings-status",
        { body: {} },
      );
      if (error) throw new Error("storage_status_unavailable");
      const normalized = normalizeStorageSettingsStatus(data);
      if (!normalized) throw new Error("storage_status_unavailable");
      return normalized;
    },
    staleTime: 30_000,
    retry: 1,
  });
}
