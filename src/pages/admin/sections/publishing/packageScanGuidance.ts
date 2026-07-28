// Pure state → guidance mapping for the saved skill/automation
// PackageUploader. Kept free of React so it can be unit-tested in
// isolation and reused by any future admin surface that needs the
// same wording. The badge label and the explanatory alert must
// agree — always derive both from this helper.

export type PackageScanStatus =
  | "pending"
  | "clean"
  | "suspicious"
  | "malicious"
  | "failed";

export type ScanGuidanceTone =
  | "success"   // clean, safe to proceed
  | "info"      // pending / no scan yet
  | "warning"   // suspicious, manual review
  | "danger";   // malicious or scan failed

export interface ScanGuidance {
  /** Short badge label, mirrored in the status pill. */
  badge: string;
  /** One-sentence explanatory message shown under the badge. */
  message: string;
  /** Tone hint drives Alert variant and badge colour class. */
  tone: ScanGuidanceTone;
  /** True when the current status blocks Review/Publishing transitions. */
  blocksPublishing: boolean;
}

/**
 * Map a package-scan status (or null when no scan row exists yet) to
 * the guidance the admin should see. Pure and total — every status
 * plus the null case has an explicit branch.
 */
export function packageScanGuidance(
  status: PackageScanStatus | null | undefined,
): ScanGuidance {
  switch (status) {
    case "clean":
      return {
        badge: "Clean",
        message:
          "This package passed its security scan. You can move it into review and publish it when you are ready.",
        tone: "success",
        blocksPublishing: false,
      };
    case "pending":
      return {
        badge: "Scan pending",
        message:
          "Scanning is in progress. Publishing remains blocked until a scanner marks this package clean.",
        tone: "info",
        blocksPublishing: true,
      };
    case "suspicious":
      return {
        badge: "Suspicious",
        message:
          "This package was flagged as suspicious. An admin must review it manually — publishing remains blocked.",
        tone: "warning",
        blocksPublishing: true,
      };
    case "malicious":
      return {
        badge: "Malicious",
        message:
          "This package is blocked because the scanner found a threat. Replace the file with a clean version and re-upload.",
        tone: "danger",
        blocksPublishing: true,
      };
    case "failed":
      return {
        badge: "Scan failed",
        message:
          "Scanning failed to complete. Publishing remains blocked; an admin can retry the scan from Package Scans.",
        tone: "danger",
        blocksPublishing: true,
      };
    case null:
    case undefined:
    default:
      return {
        badge: "No scan yet",
        message:
          "No scan has been performed yet. Publishing is blocked until the package has been uploaded and marked clean.",
        tone: "info",
        blocksPublishing: true,
      };
  }
}
