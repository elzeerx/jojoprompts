/**
 * Pure derivation helpers for the Admin V2 publishing queues (Drafts, Review).
 *
 * These functions never mutate lifecycle state — the server (admin_publish_resource,
 * admin_transition_resource_lifecycle) is the sole authority for transitions. They
 * exist so the UI can show attention/completeness hints and enable/disable action
 * buttons in a way that mirrors the server contract without having to call the
 * publish RPC once per row.
 *
 * The rules below are a strict subset of admin_publish_resource() in
 * supabase/migrations/20260722214306_… — anything permitted here must also be
 * permitted server-side; the server may still reject on additional grounds
 * (products / bundle rules, etc.), which is surfaced as toast errors.
 */

export type ResourceType =
  | "skill"
  | "automation"
  | "prompt"
  | "prompt_pack"
  | "image_style"
  | "bundle";

export type Lifecycle = "draft" | "review" | "published" | "archived";
export type ScanState =
  | "clean"
  | "pending"
  | "suspicious"
  | "malicious"
  | "failed"
  | "none";

export interface QueueRowInput {
  id: string;
  type: ResourceType;
  lifecycle: Lifecycle;
  title_en: string | null;
  summary_en: string | null;
  description_en: string | null;
  current_version_id: string | null;
  file_count: number;
  scan_status: ScanState;
  has_platform_compatibility: boolean;
  has_installation_guide: boolean;
  has_active_product: boolean;
}

export type ReadinessCode =
  | "missing_title_en"
  | "missing_summary_en"
  | "missing_description_en"
  | "no_current_version"
  | "missing_platform_compatibility"
  | "missing_installation_guide"
  | "no_package_files"
  | "scan_missing"
  | "scan_not_clean"
  | "scan_pending"
  | "no_active_product";

export interface Readiness {
  blockers: ReadinessCode[];
  /** Fatal blockers only (server-side publish would reject). */
  isPublishable: boolean;
  /** True if there are zero blockers for a Submit-for-review action. */
  isSubmittable: boolean;
  /** True when a scan is pending (soft-block; UI shows "Scan in progress"). */
  isScanPending: boolean;
}

const READABLE: Record<ReadinessCode, string> = {
  missing_title_en: "Missing English title",
  missing_summary_en: "Missing English summary",
  missing_description_en: "Missing English description",
  no_current_version: "No current version set",
  missing_platform_compatibility: "No platform compatibility declared",
  missing_installation_guide: "No installation guide",
  no_package_files: "No package files uploaded",
  scan_missing: "Package has not been scanned",
  scan_not_clean: "Latest scan is not clean",
  scan_pending: "Package scan is in progress",
  no_active_product: "No active product / pricing set",
};

export function describeReadiness(code: ReadinessCode): string {
  return READABLE[code] ?? code;
}

export function deriveReadiness(row: QueueRowInput): Readiness {
  const blockers: ReadinessCode[] = [];
  if (!row.title_en?.trim()) blockers.push("missing_title_en");
  if (!row.summary_en?.trim()) blockers.push("missing_summary_en");
  if (!row.description_en?.trim()) blockers.push("missing_description_en");
  if (!row.current_version_id) blockers.push("no_current_version");

  const requiresPackage = row.type === "skill" || row.type === "automation";
  let scanPending = false;
  if (requiresPackage) {
    if (!row.has_platform_compatibility) blockers.push("missing_platform_compatibility");
    if (!row.has_installation_guide) blockers.push("missing_installation_guide");
    if (row.current_version_id) {
      if (row.file_count <= 0) {
        blockers.push("no_package_files");
      } else if (row.scan_status === "none") {
        blockers.push("scan_missing");
      } else if (row.scan_status === "pending") {
        // Fail-closed: a pending scan blocks BOTH submit-for-review and publish.
        // The server (admin_publish_resource + admin_transition_resource_lifecycle)
        // rejects any scan status other than 'clean'.
        blockers.push("scan_pending");
        scanPending = true;
      } else if (row.scan_status !== "clean") {
        // suspicious | malicious | failed
        blockers.push("scan_not_clean");
      }
    }
  }

  if (!row.has_active_product) blockers.push("no_active_product");

  const hasAnyBlocker = blockers.length > 0;
  return {
    blockers,
    isPublishable: !hasAnyBlocker,
    isSubmittable: !hasAnyBlocker,
    isScanPending: scanPending,
  };
}
