import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";

export interface AdminReportRow {
  id: string;
  status: ReportStatus;
  category: string;
  details: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolver_notes: string | null;
  resource_id: string | null;
  resource_slug: string | null;
  resource_title: string | null;
  reporter_user_id: string | null;
  reporter_email_masked: string | null;
}

export interface AdminReportsList {
  total_count: number;
  limit: number;
  offset: number;
  rows: AdminReportRow[];
}

export interface AdminReportsListParams {
  status?: ReportStatus[] | null;
  search?: string | null;
  limit?: number;
  offset?: number;
}

export const adminReportsKeys = {
  list: (p: AdminReportsListParams) => ["admin", "v2", "reports", "list", p] as const,
};

export function useAdminReports(params: AdminReportsListParams) {
  return useQuery<AdminReportsList>({
    queryKey: adminReportsKeys.list(params),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("v2_admin_list_reports", {
        p_status: params.status ?? null,
        p_search: params.search ?? null,
        p_limit: params.limit ?? 50,
        p_offset: params.offset ?? 0,
      });
      if (error) throw error;
      return (data as unknown as AdminReportsList) ?? { total_count: 0, limit: 50, offset: 0, rows: [] };
    },
    staleTime: 15_000,
  });
}

export function useUpdateReportStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { reportId: string; status: ReportStatus; notes?: string | null }) => {
      const { data, error } = await supabase.rpc("v2_admin_update_report_status", {
        p_report_id: vars.reportId,
        p_next_status: vars.status,
        p_notes: vars.notes ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "v2", "reports"] });
    },
  });
}
