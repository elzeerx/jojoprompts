/**
 * Pure server-side publish gate mirror for the six V2 resource types.
 *
 * This mirrors `admin_publish_resource()` server rules so the client can
 * predict which resources will pass validation without running one RPC per
 * row. Anything permitted here MUST be permitted by the server; the server
 * remains the sole authority.
 */
export type ResourceType =
  | "skill"
  | "automation"
  | "prompt"
  | "prompt_pack"
  | "image_style"
  | "bundle";

export interface PublishInput {
  type: ResourceType;
  title_en: string | null;
  summary_en: string | null;
  description_en: string | null;
  current_version_id: string | null;
  has_platform_compatibility: boolean;
  has_installation_guide: boolean;
  has_package_files: boolean;
  /** "clean" | "pending" | "suspicious" | "malicious" | "failed" | "none" */
  scan_status:
    | "clean"
    | "pending"
    | "suspicious"
    | "malicious"
    | "failed"
    | "none";
  active_product_count: number;
  has_legacy_lifetime_product: boolean;
  // Bundle-specific
  has_positive_bundle_product: boolean;
  has_bundle_items: boolean;
  bundle_item_ids: string[];
  self_id: string;
}

export function validatePublish(input: PublishInput): string[] {
  const errs: string[] = [];
  if (!input.title_en?.trim()) errs.push("missing_title_en");
  if (!input.summary_en?.trim()) errs.push("missing_summary_en");
  if (!input.description_en?.trim()) errs.push("missing_description_en");
  if (!input.current_version_id) errs.push("no_current_version");

  if (input.type === "skill" || input.type === "automation") {
    if (!input.has_platform_compatibility) errs.push("missing_platform_compatibility");
    if (!input.has_installation_guide) errs.push("missing_installation_guide");
    if (input.current_version_id) {
      if (!input.has_package_files) {
        errs.push("no_package_files");
      } else if (input.scan_status === "none") {
        errs.push("scan_missing");
      } else if (input.scan_status !== "clean") {
        errs.push(`scan_not_clean:${input.scan_status}`);
      }
    }
  }

  if (input.has_legacy_lifetime_product) errs.push("legacy_lifetime_product_present");
  if (input.active_product_count <= 0) errs.push("no_active_product");

  if (input.type === "bundle") {
    if (!input.has_positive_bundle_product) errs.push("bundle_requires_positive_bundle_product");
    if (!input.has_bundle_items) errs.push("bundle_empty");
    if (input.bundle_item_ids.includes(input.self_id)) errs.push("bundle_self_inclusion");
    const seen = new Set<string>();
    for (const id of input.bundle_item_ids) {
      if (seen.has(id)) { errs.push("bundle_duplicate_item"); break; }
      seen.add(id);
    }
  }

  return errs;
}
