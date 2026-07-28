/**
 * Contract tests for the V2 Resource JSON Importer.
 *
 * Source-only assertions plus pure-function checks against the exported
 * validator/mapper/payload builder. No network, no Supabase, no rendering.
 */
import { describe, it, expect } from "bun:test";
declare const require: (m: string) => any;
const { readFileSync } = require("fs");

import {
  V2_RESOURCE_TYPES,
  FORBIDDEN_TOP_LEVEL_FIELDS,
  v2ResourceDraftSchema,
  mapLegacyPromptToV2Draft,
  validateRow,
  buildDraftPayload,
} from "@/pages/admin/sections/publishing/jsonResourceImporterContract";

const IMPORTER = readFileSync(
  "src/pages/admin/sections/publishing/JsonResourceImporter.tsx",
  "utf8",
) as string;
const ELEMENTS = readFileSync(
  "src/pages/admin/layout/adminSectionElements.tsx",
  "utf8",
) as string;
const APP = readFileSync("src/App.tsx", "utf8") as string;
const LEGACY = readFileSync(
  "src/pages/admin/sections/publishing/LegacyMigrationPreview.tsx",
  "utf8",
) as string;

describe("V2 Resource JSON Importer — route wiring", () => {
  it("route /admin/publishing/imports/json is wired to JsonResourceImporter", () => {
    expect(ELEMENTS).toMatch(/JsonResourceImporter\s*=\s*lazy\(/);
    expect(ELEMENTS).toMatch(
      /publishingImportsJson:\s*wrap\(<JsonResourceImporter\s*\/>\)/,
    );
    expect(APP).toMatch(
      /path="publishing\/imports\/json"\s+element=\{adminSectionElements\.publishingImportsJson\}/,
    );
  });

  it("no reference remains to the legacy JsonPromptImporter surface in the active element map", () => {
    expect(/JsonPromptImporter/.test(ELEMENTS)).toBe(false)
  });
});

describe("V2 Resource JSON Importer — page contract", () => {
  it("presents a V2-Resource heading, not the legacy 'JSON Prompt Importer'", () => {
    expect(IMPORTER).toMatch(/V2 Resource JSON Importer/);
    expect(/JSON Prompt Importer/.test(IMPORTER)).toBe(false)
  });

  it("advertises all six locked V2 resource types in the UI", () => {
    for (const t of V2_RESOURCE_TYPES) {
      expect(IMPORTER).toContain(t);
    }
  });

  it("exposes an explicit Back to Imports action", () => {
    expect(IMPORTER).toMatch(/data-json-back-to-imports/);
    expect(IMPORTER).toMatch(/to="\/admin\/publishing\/imports"/);
    expect(IMPORTER).toMatch(/Back to Imports/);
  });

  it("provides bilingual (Arabic) copy", () => {
    expect(IMPORTER).toMatch(/مستورد موارد V2/);
    expect(IMPORTER).toMatch(/العودة إلى الاستيراد/);
  });

  it("has 44px touch targets and one-column mobile layout", () => {
    const hits = (IMPORTER.match(/min-h-\[44px\]/g) ?? []).length;
    expect(hits).toBeGreaterThanOrEqual(4);
    expect(IMPORTER).toMatch(/grid-cols-1/);
    expect(IMPORTER).toMatch(/lg:grid-cols-2/);
    expect(IMPORTER).toMatch(/dir=\{dir\}/);
  });

  it("never invokes the legacy prompts table or PromptService", () => {
    expect(/PromptService/.test(IMPORTER)).toBe(false)
    expect(/\.from\(["']prompts["']\)/.test(IMPORTER)).toBe(false)
    expect(/createPrompt/.test(IMPORTER)).toBe(false)
    expect(/prompts library/i.test(IMPORTER)).toBe(false)
  });

  it("never auto-publishes or transitions lifecycle", () => {
    expect(/admin_publish_resource/.test(IMPORTER)).toBe(false)
    expect(/admin_transition_resource_lifecycle/.test(IMPORTER)).toBe(false)
  });

  it("persists exclusively through the authorized save_admin_resource_draft RPC", () => {
    expect(IMPORTER).toMatch(/rpc\(\s*["']save_admin_resource_draft["']/);
    // No arbitrary table writes from the importer.
    expect(/\.from\(["'][^"']+["']\)\.(insert|update|upsert|delete)\(/.test(IMPORTER)).toBe(false)
    // No edge function invocations.
    expect(/functions\.invoke\(/.test(IMPORTER)).toBe(false)
  });
});

describe("V2 Resource JSON Importer — validator", () => {
  const goodSkill = {
    slug: "example-skill",
    type: "skill",
    title_en: "Example Skill",
    version: "1.0.0",
    products: [{ sku: "example-free", product_type: "free", title_en: "Free", price_fils: 0 }],
  };

  it("accepts a valid draft for every V2 resource type", () => {
    for (const type of V2_RESOURCE_TYPES) {
      const item = {
        ...goodSkill,
        slug: `example-${type.replace(/_/g, "-")}`,
        type,
        products:
          type === "bundle"
            ? [{ sku: `${type}-bundle`, product_type: "bundle", title_en: "Bundle", price_fils: 4500 }]
            : [{ sku: `${type}-free`, product_type: "free", title_en: "Free", price_fils: 0 }],
      };
      const res = validateRow(item, 0);
      expect({ type, ok: res.ok, errors: res.errors }).toEqual({ type, ok: true, errors: [] });
    }
  });

  it("rejects every documented privileged/server-owned field", () => {
    for (const f of FORBIDDEN_TOP_LEVEL_FIELDS) {
      const res = validateRow({ ...goodSkill, [f]: "attacker" }, 0);
      expect({ f, ok: res.ok }).toEqual({ f, ok: false });
      expect(res.errors.join(" ")).toMatch(/privileged/i);
    }
  });

  it("rejects invalid slug and unknown type", () => {
    expect(validateRow({ ...goodSkill, slug: "Not A Slug" }, 0).ok).toBe(false);
    expect(validateRow({ ...goodSkill, type: "not-a-type" }, 0).ok).toBe(false);
  });

  it("rejects negative/non-integer prices via schema", () => {
    const bad = { ...goodSkill, products: [{ sku: "x", product_type: "individual", title_en: "X", price_fils: -1 }] };
    expect(validateRow(bad, 0).ok).toBe(false);
  });

  it("enforces free=0, paid>0, and bundle/individual type coupling", () => {
    const freeNonZero = { ...goodSkill, products: [{ sku: "a", product_type: "free", title_en: "A", price_fils: 500 }] };
    const paidZero = { ...goodSkill, products: [{ sku: "b", product_type: "individual", title_en: "B", price_fils: 0 }] };
    const bundleOnNonBundle = { ...goodSkill, products: [{ sku: "c", product_type: "bundle", title_en: "C", price_fils: 4500 }] };
    expect(validateRow(freeNonZero, 0).ok).toBe(false);
    expect(validateRow(paidZero, 0).ok).toBe(false);
    expect(validateRow(bundleOnNonBundle, 0).ok).toBe(false);
  });

  it("parses tags as CSV string or array", () => {
    const csv = validateRow({ ...goodSkill, tags: "a, b ,c" }, 0);
    expect(csv.ok).toBe(true);
    expect(csv.draft?.tags).toEqual(["a", "b", "c"]);
    const arr = validateRow({ ...goodSkill, tags: ["x", "y"] }, 0);
    expect(arr.draft?.tags).toEqual(["x", "y"]);
  });
});

describe("V2 Resource JSON Importer — legacy prompt compatibility mapping", () => {
  it("maps legacy prompt JSON into a valid V2 `prompt` draft without dropping title/content/tags", () => {
    const legacy = {
      title: "Haiku Generator",
      content: "Write a haiku about {topic}.",
      description: "Short haiku",
      tags: ["poetry", "creative"],
    };
    const mapped = mapLegacyPromptToV2Draft(legacy)!;
    expect(mapped.type).toBe("prompt");
    expect(mapped.title_en).toBe("Haiku Generator");
    expect(mapped.description_en).toBe(legacy.content);
    expect(mapped.tags).toEqual(["poetry", "creative"]);
    expect(mapped.slug).toMatch(/^haiku-generator$/);

    const res = validateRow(legacy, 0);
    expect(res.ok).toBe(true);
    expect(res.fromLegacy).toBe(true);
    expect(res.draft?.type).toBe("prompt");
  });

  it("does NOT treat an object with an explicit V2 type as legacy", () => {
    expect(mapLegacyPromptToV2Draft({ type: "skill", content: "x" })).toBeNull();
  });
});

describe("V2 Resource JSON Importer — single-object and array parsing", () => {
  it("v2ResourceDraftSchema parses a minimal valid single object", () => {
    const parsed = v2ResourceDraftSchema.safeParse({
      slug: "single-item",
      type: "prompt",
      title_en: "Single",
    });
    expect(parsed.success).toBe(true);
  });

  it("importer source parses both a single object and an array", () => {
    // Contract markers in the source: it wraps a single parsed object into [parsed]
    // and handles the array branch explicitly.
    expect(IMPORTER).toMatch(/Array\.isArray\(parsed\)\s*\?\s*parsed\s*:\s*\[parsed\]/);
  });
});

describe("V2 Resource JSON Importer — draft payload", () => {
  it("emits KWD prices as non-negative integer fils", () => {
    const payload = buildDraftPayload({
      slug: "priced-skill",
      type: "skill",
      title_en: "Priced",
      title_ar: "",
      summary_en: "",
      summary_ar: "",
      description_en: "",
      description_ar: "",
      category: "",
      tags: [],
      hero_image_path: "",
      version: "1.0.0",
      changelog_en: "",
      platform_compatibility: [],
      products: [
        { sku: "a", product_type: "individual", title_en: "A", price_fils: 1500 },
        { sku: "b", product_type: "free", title_en: "B", price_fils: 0 },
      ],
      bundle_items: [],
    });
    for (const p of payload.products) {
      expect(Number.isInteger(p.price_fils)).toBe(true);
      expect(p.price_fils).toBeGreaterThanOrEqual(0);
      expect(p.currency).toBe("KWD");
    }
    // Client-supplied server-owned identifiers are never in the payload.
    expect(payload.resource_id).toBeNull();
    // Never sets a lifecycle transition or publication flag.
    expect(/lifecycle|is_published|published_at/.test(JSON.stringify(payload))).toBe(false);
  });

  it("bundle_items only included for bundle type", () => {
    const skill = buildDraftPayload({
      slug: "s", type: "skill", title_en: "S",
      title_ar: "", summary_en: "", summary_ar: "", description_en: "", description_ar: "",
      category: "", tags: [], hero_image_path: "", version: "1.0.0", changelog_en: "",
      platform_compatibility: [], products: [], bundle_items: ["should-be-dropped"],
    });
    expect(skill.bundle_items).toEqual([]);
    const bundle = buildDraftPayload({
      slug: "b", type: "bundle", title_en: "B",
      title_ar: "", summary_en: "", summary_ar: "", description_en: "", description_ar: "",
      category: "", tags: [], hero_image_path: "", version: "1.0.0", changelog_en: "",
      platform_compatibility: [], products: [], bundle_items: ["r1", "r2"],
    });
    expect(bundle.bundle_items).toEqual(["r1", "r2"]);
  });
});

describe("Legacy migration verification — Back to Imports action", () => {
  it("adds an explicit Back to Imports button in the page header", () => {
    expect(LEGACY).toMatch(/data-legacy-back-to-imports/);
    expect(LEGACY).toMatch(/Back to Imports\s*\/\s*العودة إلى الاستيراد/);
  });

  it("keeps the read-only Execute-migration-disabled safeguard", () => {
    expect(LEGACY).toMatch(/Execute migration is disabled/);
    expect(LEGACY).toMatch(/disabled/);
  });
});
