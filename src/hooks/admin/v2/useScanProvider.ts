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
      return data as { ok: boolean; scan_id?: string; error?: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "v2", "package-scans"] });
      qc.invalidateQueries({ queryKey: adminPackageScansKeys.list({}) });
      qc.invalidateQueries({ queryKey: adminResourceVersionsKeys.detail(null).slice(0, 4) });
    },
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
      return data as { ok: boolean };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "v2", "package-scans"] });
    },
  });
}
