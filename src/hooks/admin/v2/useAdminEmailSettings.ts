import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  normalizeEmailSettingsStatus,
  normalizeEmailSettingsSummary,
  type EmailSettingsStatus,
  type EmailSettingsSummary,
} from "@/lib/v2/admin/emailSettings";

export function useAdminEmailSettingsStatus() {
  return useQuery<EmailSettingsStatus>({
    queryKey: ["admin", "v2", "email-settings-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "v2-admin-email-settings-status",
        { body: {} },
      );
      if (error) throw new Error("email_status_unavailable");
      const normalized = normalizeEmailSettingsStatus(data);
      if (!normalized) throw new Error("email_status_unavailable");
      return normalized;
    },
    staleTime: 30_000,
    retry: 1,
  });
}

export function useAdminEmailSettingsSummary() {
  return useQuery<EmailSettingsSummary>({
    queryKey: ["admin", "v2", "email-settings-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "v2_admin_email_settings_summary" as never,
      );
      if (error) throw new Error("email_summary_unavailable");
      const normalized = normalizeEmailSettingsSummary(data);
      if (!normalized) throw new Error("email_summary_unavailable");
      return normalized;
    },
    staleTime: 30_000,
    retry: 1,
  });
}
