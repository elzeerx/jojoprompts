import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { adminPackageScansKeys } from "./useAdminPackageScans";
import { adminResourceVersionsKeys } from "./useAdminResourceVersions";

export type ScanReadinessReason =
  | "ok"
  | "no_api_key"
  | "no_worker_secret"
  | "provider_unreachable"
  | "provider_unauthorized"
  | "not_paid_account"
  | "upload_size_too_small"
  | "no_scan_engines"
  | "private_scan_not_enforced";

export interface ScanReadiness {
  configured: boolean;
  ready: boolean;
  max_upload_mb: number | null;
  private_scan_enforced: boolean;
  license_ready: boolean;
  reason: ScanReadinessReason;
}

export interface ProviderStatusResponse {
  ok: boolean;
  provider: string;
  readiness: ScanReadiness;
}

const CONTROL_FN = "v2-admin-package-scan-control";

// Invalidate every query that reads scan state after a successful control action.
function invalidateScanQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["admin", "v2", "package-scans"] });
  qc.invalidateQueries({ queryKey: ["admin", "v2", "resource-versions"] });
}

export function useScanProviderStatus() {
  return useQuery<ProviderStatusResponse>({
    queryKey: ["admin", "v2", "package-scans", "provider-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(CONTROL_FN, {
        body: { action: "provider_status" },
      });
      if (error) throw error;
      return data as ProviderStatusResponse;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useQueueScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (versionId: string) => {
      const { data, error } = await supabase.functions.invoke(CONTROL_FN, {
        body: { action: "queue_scan", version_id: versionId },
      });
      if (error) throw error;
      const body = data as { ok: boolean; scan_id?: string; error?: string };
      if (!body.ok) throw new Error(body.error ?? "queue_failed");
      return body;
    },
    onSuccess: () => invalidateScanQueries(qc),
  });
}

export function useRefreshScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (scanId: string) => {
      const { data, error } = await supabase.functions.invoke(CONTROL_FN, {
        body: { action: "refresh_scan", scan_id: scanId },
      });
      if (error) throw error;
      const body = data as { ok: boolean; error?: string };
      if (!body.ok) throw new Error(body.error ?? "refresh_failed");
      return body;
    },
    onSuccess: () => invalidateScanQueries(qc),
  });
}

// ------------------------- Safe admin scan-details RPC -------------------------

export interface AdminScanDetailFile {
  file_name: string | null;
  content_type: string | null;
  size_bytes: number | null;
}

export interface AdminScanDetailItem {
  id: string;
  status: "pending" | "clean" | "suspicious" | "malicious" | "failed";
  result_code: number | null;
  progress: number;
  total_engines: number | null;
  detected_engines: number | null;
  findings: unknown;
  attempt_count: number;
  submitted_at: string | null;
  completed_at: string | null;
  created_at: string;
  file: AdminScanDetailFile;
}

export interface AdminScanDetailScan {
  id: string;
  resource_version_id: string;
  scanner: string;
  status: "pending" | "clean" | "suspicious" | "malicious" | "failed";
  findings: unknown;
  scanned_at: string | null;
  created_at: string;
  updated_at: string;
  requested_at: string | null;
  completed_at: string | null;
  attempt_count: number;
  last_error_code: string | null;
}

export interface AdminScanDetailCounts {
  items: number;
  clean: number;
  pending: number;
  suspicious: number;
  malicious: number;
  failed: number;
  progress_pct: number;
  total_engines: number;
  detected_engines: number;
}

export interface AdminScanDetail {
  scan: AdminScanDetailScan;
  counts: AdminScanDetailCounts;
  items: AdminScanDetailItem[];
}

export const adminScanDetailsKeys = {
  detail: (id: string | null) =>
    ["admin", "v2", "package-scans", "detail", id] as const,
};

export function useAdminPackageScanDetails(scanId: string | null) {
  return useQuery<AdminScanDetail | null>({
    queryKey: adminScanDetailsKeys.detail(scanId),
    queryFn: async () => {
      if (!scanId) return null;
      const { data, error } = await supabase.rpc(
        "v2_admin_get_package_scan_details",
        { p_scan_id: scanId },
      );
      if (error) throw error;
      return (data as unknown as AdminScanDetail | null) ?? null;
    },
    enabled: !!scanId,
    staleTime: 10_000,
  });
}

// Re-export for consumers that used to import the key groups here.
export { adminPackageScansKeys, adminResourceVersionsKeys };
