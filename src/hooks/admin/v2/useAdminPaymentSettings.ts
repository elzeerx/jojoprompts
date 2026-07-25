import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  stripStatusFields,
  type PaymentSettingsStatus,
  type PaymentSettingsSummary,
} from "@/lib/v2/admin/paymentSettings";

export function useAdminPaymentSettingsStatus() {
  return useQuery<PaymentSettingsStatus>({
    queryKey: ["admin", "v2", "payments-settings-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "v2-admin-payment-settings-status",
        { body: {} },
      );
      if (error) throw error;
      // Defensive strip in case anything unexpected slipped into the payload.
      return stripStatusFields(data) as unknown as PaymentSettingsStatus;
    },
    staleTime: 30_000,
    retry: 1,
  });
}

export function useAdminPaymentSettingsSummary() {
  return useQuery<PaymentSettingsSummary>({
    queryKey: ["admin", "v2", "payments-settings-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "v2_admin_payment_settings_summary" as never,
      );
      if (error) throw error;
      return data as unknown as PaymentSettingsSummary;
    },
    staleTime: 30_000,
    retry: 1,
  });
}
