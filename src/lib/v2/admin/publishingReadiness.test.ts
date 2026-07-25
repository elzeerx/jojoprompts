import { describe, expect, it } from "bun:test";
import { deriveReadiness, describeReadiness, type QueueRowInput } from "./publishingReadiness";

const base: QueueRowInput = {
  id: "r1",
  type: "prompt",
  lifecycle: "draft",
  title_en: "Title",
  summary_en: "Summary",
  description_en: "Description",
  current_version_id: "v1",
  file_count: 0,
  scan_status: "none",
  has_platform_compatibility: true,
  has_installation_guide: true,
  has_active_product: true,
};

describe("deriveReadiness", () => {
  it("returns publishable for a fully-formed prompt draft", () => {
    const r = deriveReadiness(base);
    expect(r.blockers).toEqual([]);
    expect(r.isPublishable).toBe(true);
    expect(r.isSubmittable).toBe(true);
    expect(r.isScanPending).toBe(false);
  });

  it("flags missing metadata blockers", () => {
    const r = deriveReadiness({ ...base, title_en: "", summary_en: null, description_en: "" });
    expect(r.blockers).toContain("missing_title_en");
    expect(r.blockers).toContain("missing_summary_en");
    expect(r.blockers).toContain("missing_description_en");
    expect(r.isPublishable).toBe(false);
  });

  it("requires files+clean scan for skills/automations", () => {
    const r = deriveReadiness({ ...base, type: "skill" });
    expect(r.blockers).toContain("no_package_files");
    expect(r.isPublishable).toBe(false);
  });

  it("treats a pending scan as a soft blocker only", () => {
    const r = deriveReadiness({
      ...base,
      type: "automation",
      file_count: 2,
      scan_status: "pending",
    });
    expect(r.blockers).toContain("scan_pending");
    expect(r.isScanPending).toBe(true);
    expect(r.isPublishable).toBe(true);
    expect(r.isSubmittable).toBe(true);
  });

  it("flags a malicious scan as a fatal blocker", () => {
    const r = deriveReadiness({
      ...base,
      type: "skill",
      file_count: 1,
      scan_status: "malicious",
    });
    expect(r.blockers).toContain("scan_not_clean");
    expect(r.isPublishable).toBe(false);
  });

  it("does not require platform/installation for a prompt", () => {
    const r = deriveReadiness({
      ...base,
      has_platform_compatibility: false,
      has_installation_guide: false,
    });
    expect(r.blockers.includes("missing_platform_compatibility")).toBe(false);
    expect(r.blockers.includes("missing_installation_guide")).toBe(false);
  });

  it("requires an active product regardless of type", () => {
    const r = deriveReadiness({ ...base, has_active_product: false });
    expect(r.blockers).toContain("no_active_product");
    expect(r.isPublishable).toBe(false);
  });

  it("describeReadiness returns human copy for known codes", () => {
    expect(describeReadiness("scan_not_clean")).toMatch(/scan/i);
    expect(describeReadiness("no_active_product")).toMatch(/product/i);
  });
});
