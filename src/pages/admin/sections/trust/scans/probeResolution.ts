import type { AdminScanDetail } from "@/hooks/admin/v2/useScanProvider";

/**
 * Pure fail-closed predicate for a per-scan pending-child probe result.
 * A result is "unresolved" whenever it is still loading/fetching/pending,
 * has errored, or has not returned a valid detail payload with a numeric
 * `counts.pending`. Extracted for unit testing without React/Supabase deps.
 */
export interface ProbeResultShape {
  isLoading?: boolean;
  isFetching?: boolean;
  isPending?: boolean;
  isError?: boolean;
  error?: unknown;
  data?: AdminScanDetail | null | undefined;
}

export function isProbeResultUnresolved(r: ProbeResultShape): boolean {
  if (r.isLoading || r.isFetching || r.isPending) return true;
  if (r.isError || r.error) return true;
  const detail = r.data;
  if (!detail || typeof detail !== "object") return true;
  if (!detail.counts || typeof detail.counts.pending !== "number") return true;
  return false;
}
