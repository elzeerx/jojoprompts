import { describe, expect, it } from "bun:test";
import { validatePublish, type PublishInput, type ResourceType } from "./publishValidation";

const baseFor = (type: ResourceType, id = "self-1"): PublishInput => ({
  type,
  title_en: "T",
  summary_en: "S",
  description_en: "D",
  current_version_id: "v1",
  has_platform_compatibility: type === "skill" || type === "automation",
  has_installation_guide: type === "skill" || type === "automation",
  has_package_files: type === "skill" || type === "automation",
  scan_status: type === "skill" || type === "automation" ? "clean" : "none",
  active_product_count: 1,
  has_legacy_lifetime_product: false,
  has_positive_bundle_product: type === "bundle",
  has_bundle_items: type === "bundle",
  bundle_item_ids: type === "bundle" ? ["other-1"] : [],
  self_id: id,
});

describe("validatePublish — six V2 types", () => {
  const types: ResourceType[] = ["skill","automation","prompt","prompt_pack","image_style","bundle"];

  it("passes cleanly for a fully-formed instance of every V2 type", () => {
    for (const t of types) {
      expect(validatePublish(baseFor(t))).toEqual([]);
    }
  });

  it("does NOT require package/platform/scan for prompt-like or image_style types", () => {
    for (const t of ["prompt","prompt_pack","image_style"] as ResourceType[]) {
      const errs = validatePublish({
        ...baseFor(t),
        has_platform_compatibility: false,
        has_installation_guide: false,
        has_package_files: false,
        scan_status: "none",
      });
      expect(errs).toEqual([]);
    }
  });

  it("requires package + clean scan for skill/automation", () => {
    for (const t of ["skill","automation"] as ResourceType[]) {
      const missing = validatePublish({ ...baseFor(t), has_package_files: false, scan_status: "none" });
      expect(missing).toContain("no_package_files");
      const dirty = validatePublish({ ...baseFor(t), scan_status: "suspicious" });
      expect(dirty).toContain("scan_not_clean:suspicious");
      const pending = validatePublish({ ...baseFor(t), scan_status: "pending" });
      expect(pending).toContain("scan_not_clean:pending");
    }
  });

  it("blocks bundle publish on empty items, no-positive-price, self-reference, and duplicates", () => {
    const empty = validatePublish({ ...baseFor("bundle"), has_bundle_items: false, bundle_item_ids: [] });
    expect(empty).toContain("bundle_empty");

    const noPositive = validatePublish({ ...baseFor("bundle"), has_positive_bundle_product: false });
    expect(noPositive).toContain("bundle_requires_positive_bundle_product");

    const selfRef = validatePublish({ ...baseFor("bundle","x"), bundle_item_ids: ["x","y"] });
    expect(selfRef).toContain("bundle_self_inclusion");

    const dup = validatePublish({ ...baseFor("bundle"), bundle_item_ids: ["a","a"] });
    expect(dup).toContain("bundle_duplicate_item");
  });

  it("rejects missing metadata for every type", () => {
    for (const t of types) {
      const errs = validatePublish({ ...baseFor(t), title_en: "", summary_en: null, description_en: "" });
      expect(errs).toContain("missing_title_en");
      expect(errs).toContain("missing_summary_en");
      expect(errs).toContain("missing_description_en");
    }
  });

  it("flags no_active_product and legacy lifetime products", () => {
    const noProd = validatePublish({ ...baseFor("prompt"), active_product_count: 0 });
    expect(noProd).toContain("no_active_product");
    const legacy = validatePublish({ ...baseFor("prompt"), has_legacy_lifetime_product: true });
    expect(legacy).toContain("legacy_lifetime_product_present");
  });
});
