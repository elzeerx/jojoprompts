import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  adminScanDetailsKeys,
  type AdminScanDetail,
  type AdminScanDetailScan,
} from "./useScanProvider";

/**
 * For each scan in the version whose aggregate status is *not* clean, probe
 * the safe admin-only `v2_admin_get_package_scan_details` RPC to see if any
 * package_scan_items remain pending. This closes the mismatch where the
 * frontend allowed Queue on a terminal aggregate (failed/suspicious/malicious)
 * while child items were still pending server-side.
 *
 * We deliberately skip scans with aggregate `clean` — they can never have
 * recoverable pending items — and we do not query `package_scan_items`
 * directly from the browser.
 */
export function useVersionPendingChildProbe(
  scans: Pick<AdminScanDetailScan, "id" | "status">[] | undefined,
) {
  const targetIds = useMemo(
    () =>
      (scans ?? [])
        .filter((s) => s.status !== "clean")
        .map((s) => s.id),
    [scans],
  );

  const results = useQueries({
    queries: targetIds.map((id) => ({
      queryKey: adminScanDetailsKeys.detail(id),
      queryFn: async () => {
        const { data, error } = await supabase.rpc(
          "v2_admin_get_package_scan_details",
          { p_scan_id: id },
        );
        if (error) throw error;
        return (data as unknown as AdminScanDetail | null) ?? null;
      },
      staleTime: 10_000,
    })),
  });

  const isLoading =
    targetIds.length > 0 && results.some((r) => r.isLoading || r.isFetching);
  const hasPendingChild = results.some(
    (r) => (r.data?.counts?.pending ?? 0) > 0,
  );

  return { isLoading, hasPendingChild } as const;
}
