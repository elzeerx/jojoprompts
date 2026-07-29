import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const publisher = readFileSync(
  "src/pages/admin/sections/publishing/ResourcePublisher.tsx",
  "utf8",
);

describe("unified publisher bilingual contract", () => {
  it("round-trips every bilingual delivery field supported by the schema", () => {
    for (const field of [
      "changelog_ar",
      "notes_ar",
      "steps_ar",
      "label_ar",
      "terms_ar",
      "title_ar",
    ]) {
      expect(publisher).toContain(field);
    }
    expect(publisher).not.toContain("steps_ar: []");
  });

  it("exposes Arabic controls for version, platform, guides, permissions, license and product", () => {
    expect(publisher).toContain("سجل التغييرات (AR)");
    expect(publisher).toContain("ملاحظات المنصة (AR)");
    expect(publisher).toContain("عنوان الخطوة");
    expect(publisher).toContain("التسمية (AR)");
    expect(publisher).toContain("License terms (Arabic)");
    expect(publisher).toContain("العنوان (AR)");
  });

  it("exposes the public detail content fields instead of silently preserving hidden values", () => {
    for (const label of [
      "Examples (EN)",
      "Examples (AR)",
      "Limitations (EN)",
      "Limitations (AR)",
      "Uninstall guidance (EN)",
      "Uninstall guidance (AR)",
      "Support information (EN)",
      "Support information (AR)",
      "Update information (EN)",
      "Update information (AR)",
    ]) {
      expect(publisher).toContain(label);
    }
  });

  it("blocks skills and automations that omit limitations or uninstall guidance", () => {
    expect(publisher).toContain(
      "Limitations (EN) are required for skills and automations.",
    );
    expect(publisher).toContain(
      "Uninstall guidance (EN) is required for skills and automations.",
    );
  });

  it("gives version and dynamic publisher controls stable accessible names", () => {
    for (const name of [
      '<Field label="Version">',
      '<Field label="Changelog (EN)">',
      '<Field label="Changelog (AR)"',
      "minimum version`}",
      "notes in English`}",
      "notes in Arabic`}",
      "estimated minutes`}",
      "instructions in English`}",
      "instructions in Arabic`}",
      "Permission ${idx + 1} key",
      "Product ${idx + 1} SKU",
      "Product ${idx + 1} price in fils",
    ]) {
      expect(publisher).toContain(name);
    }
  });
});
