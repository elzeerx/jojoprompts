import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ReportCategory =
  | "copyright"
  | "harmful"
  | "inappropriate"
  | "spam"
  | "malware"
  | "other";

export function useSubmitResourceReport() {
  return useMutation({
    mutationFn: async (vars: { resourceId: string; category: ReportCategory; details?: string | null }) => {
      const { data, error } = await supabase.rpc("v2_submit_resource_report", {
        p_resource_id: vars.resourceId,
        p_category: vars.category,
        p_details: vars.details ?? null,
      });
      if (error) throw error;
      return data as { ok: boolean; report_id: string };
    },
  });
}
