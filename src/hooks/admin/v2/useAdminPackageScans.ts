import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PackageScanState =
  | "unscanned"
  | "pending"
  | "clean"
  | "suspicious"
  | "malicious"
  | "failed";

export const PACKAGE_SCAN_STATES: PackageScanState[] = [
  "unscanned",
  "pending",
  "clean",
  "suspicious",
  "malicious",
  "failed",
];

export interface PackageScanRow {
  version_id: string;
  resource_id: string;
  slug: string;
  resource_type: string;
  lifecycle: string;
  title_en: string | null;
  title_ar: string | null;
  version: string;
  major_version: number;
  is_current: boolean;
  file_count: number;
  package_size_bytes: number | null;
  package_checksum_present: boolean;
  latest_scan_id: string | null;
  latest_scan_status: PackageScanState;
  latest_scanner: string | null;
  latest_scanned_at: string | null;
  latest_scan_created_at: string | null;
  findings_count: number;
  updated_at: string;
}

export interface PackageScanSummary {
  total_with_files: number;
  unscanned: number;
  pending: number;
  clean: number;
  suspicious: number;
  malicious: number;
  failed: number;
}

export interface PackageScanQueueResult {
  total_count: number;
  limit: number;
  offset: number;
  rows: PackageScanRow[];
  summary: PackageScanSummary;
}

export interface UseAdminPackageScansParams {
  states?: PackageScanState[] | null;
  search?: string | null;
  limit?: number;
  offset?: number;
}

export const adminPackageScansKeys = {
  list: (p: UseAdminPackageScansParams) =>
    ["admin", "v2", "package-scans", "list", p] as const,
};

const EMPTY_SUMMARY: PackageScanSummary = {
  total_with_files: 0,
  unscanned: 0,
  pending: 0,
  clean: 0,
  suspicious: 0,
  malicious: 0,
  failed: 0,
};

export function useAdminPackageScans(params: UseAdminPackageScansParams) {
  return useQuery<PackageScanQueueResult>({
    queryKey: adminPackageScansKeys.list(params),
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "v2_admin_list_package_scan_queue",
        {
          p_states: params.states ?? null,
          p_search: params.search ?? null,
          p_limit: params.limit ?? 50,
          p_offset: params.offset ?? 0,
        },
      );
      if (error) throw error;
      return (
        (data as unknown as PackageScanQueueResult) ?? {
          total_count: 0,
          limit: params.limit ?? 50,
          offset: params.offset ?? 0,
          rows: [],
          summary: EMPTY_SUMMARY,
        }
      );
    },
    staleTime: 15_000,
  });
}
