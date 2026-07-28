import type { PackageScanState } from "@/hooks/admin/v2/useAdminPackageScans";

/**
 * Frontend queue-admission guard for the Package Scans detail sheet.
 *
 * Mirrors the server-authoritative admission rules in
 * `decideQueueAllowed` (supabase/functions/_shared/scanProvider.ts). This is
 * only a visual gate — the edge function remains authoritative. Values here
 * fail closed (Queue disabled) whenever a required signal is still loading.
 */
export type QueueGuardReason =
  | "not_ready"
  | "no_files"
  | "already_clean"
  | "pending_exists"
  | "checking";

export interface QueueGuardInput {
  providerReady: boolean;
  hasFiles: boolean;
  /**
   * True when the coverage-aware effective scan state is known for this
   * version (i.e. detail.effective_scan was returned by the RPC). When false,
   * the guard fails closed with "checking" regardless of any raw signal —
   * real unscanned is expressed as effectiveStateKnown=true with
   * latestScanStatus=null/"unscanned".
   */
  effectiveStateKnown: boolean;
  /**
   * Effective latest scan status from v2_internal_effective_scan_state, or
   * null when the helper reports no scans. MUST NOT be derived from raw
   * package_scans rows.
   */
  latestScanStatus: PackageScanState | null;
  /**
   * Effective coverage of the latest stored clean scan against the version's
   * current resource_files (from v2_internal_effective_scan_state). When false,
   * a stored 'clean' is stale and MUST be re-queuable. Undefined = unknown.
   */
  coverageValid?: boolean;
  /**
   * True when any package_scans row for the version is itself pending.
   * (Derived from the loaded scans list — cheap.)
   */
  hasPendingAggregate: boolean;
  /**
   * True when the safe per-scan detail probe has confirmed at least one
   * pending child item on any scan for the version.
   */
  hasPendingChild: boolean;
  /**
   * True while the per-scan pending-child probe is still loading. When true,
   * the guard fails closed regardless of other signals.
   */
  pendingChildProbeLoading: boolean;
}


export interface QueueGuardResult {
  canQueue: boolean;
  reason: QueueGuardReason | "ok";
}

export function evaluateQueueGuard(input: QueueGuardInput): QueueGuardResult {
  const {
    providerReady,
    hasFiles,
    effectiveStateKnown,
    latestScanStatus,
    coverageValid,
    hasPendingAggregate,
    hasPendingChild,
    pendingChildProbeLoading,
  } = input;

  if (!providerReady) return { canQueue: false, reason: "not_ready" };
  if (!hasFiles) return { canQueue: false, reason: "no_files" };
  // Fail closed BEFORE interpreting latestScanStatus: if the coverage-aware
  // effective state is not known (older RPC payload, loading, partial), we
  // cannot distinguish real unscanned from raw clean. Real unscanned is
  // expressed as effectiveStateKnown=true with latestScanStatus null/unscanned.
  if (!effectiveStateKnown) return { canQueue: false, reason: "checking" };
  if (latestScanStatus === "pending" || hasPendingAggregate) {
    return { canQueue: false, reason: "pending_exists" };
  }
  // Coverage-aware clean gating (single source of truth):
  //   coverage_valid === true  => exact current clean, block re-queue
  //   coverage_valid === false => stale clean, allow fresh scan
  //   coverage_valid === undefined => unknown — fail closed with "checking".
  if (latestScanStatus === "clean") {
    if (coverageValid === true) return { canQueue: false, reason: "already_clean" };
    if (coverageValid === undefined) return { canQueue: false, reason: "checking" };
  }
  // Fail closed while the pending-child probe is still resolving so we never
  // enable Queue in the brief window between opening the sheet and confirming
  // there are no recoverable child items under a terminal aggregate.
  if (pendingChildProbeLoading) {
    return { canQueue: false, reason: "checking" };
  }
  if (hasPendingChild) {
    return { canQueue: false, reason: "pending_exists" };
  }
  return { canQueue: true, reason: "ok" };
}

