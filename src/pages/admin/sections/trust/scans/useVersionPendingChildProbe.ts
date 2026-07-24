import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  adminScanDetailsKeys,
  type AdminScanDetail,
} from "@/hooks/admin/v2/useScanProvider";

interface ProbeScan {
  id: string;
  status: string | null;
}

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
export function useVersionPendingChildProbe(scans: ProbeScan[] | undefined) {
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
      retry: 1,
    })),
  });

  const isUnresolved =
    targetIds.length > 0 && results.some((r) => isProbeResultUnresolved(r));

  const hasPendingChild = results.some(
    (r) => (r.data?.counts?.pending ?? 0) > 0,
  );

  // Preserve prior field name (`isLoading`) for compatibility while exposing
  // the stricter fail-closed signal as `isUnresolved`.
  return { isLoading: isUnresolved, isUnresolved, hasPendingChild } as const;
}

/**
 * Re-export the pure predicate so existing importers keep working. The
 * implementation lives in `./probeResolution` to remain importable from
 * unit tests without pulling in the Supabase client (which requires
 * `localStorage`).
 */
export { isProbeResultUnresolved } from "./probeResolution";
export type { ProbeResultShape } from "./probeResolution";
