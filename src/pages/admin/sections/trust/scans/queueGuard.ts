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
  /** Latest scan status for the version, or null when unscanned. */
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
    latestScanStatus,
    coverageValid,
    hasPendingAggregate,
    hasPendingChild,
    pendingChildProbeLoading,
  } = input;

  if (!providerReady) return { canQueue: false, reason: "not_ready" };
  if (!hasFiles) return { canQueue: false, reason: "no_files" };
  if (latestScanStatus === "pending" || hasPendingAggregate) {
    return { canQueue: false, reason: "pending_exists" };
  }
  // Only exact-coverage clean blocks re-queue. Stale clean (coverage_valid
  // explicitly false) and terminal non-clean (suspicious/malicious) permit a
  // fresh scan. Server RPC re-validates atomically.
  if (latestScanStatus === "clean" && coverageValid === true) {
    return { canQueue: false, reason: "already_clean" };
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
