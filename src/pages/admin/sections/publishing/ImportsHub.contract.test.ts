/**
 * Admin V2 Publishing → Imports UX contract.
 *
 * Source-only assertions. No network, no Supabase, no runtime tools.
 * Guards the Import Hub / legacy verification split:
 *   - `/admin/publishing/imports` is the concise hub (ImportsHub),
 *     NOT the long LegacyMigrationPreview screen.
 *   - Three primary destinations with exact labels and descriptions.
 *   - The hub renders zero execution controls; the legacy verification
 *     surface still exists at `/admin/publishing/imports/legacy` with
 *     its read-only safety intact.
 *   - JSON + AI Studio routes remain intact.
 */
import { describe, it, expect } from "bun:test";
declare const require: (m: string) => any;
const { readFileSync } = require("fs");

import { IMPORTS_HUB_CARDS } from "@/pages/admin/sections/publishing/ImportsHub";

const APP = readFileSync("src/App.tsx", "utf8") as string;
const ELEMENTS = readFileSync(
  "src/pages/admin/layout/adminSectionElements.tsx",
  "utf8",
) as string;
const HUB = readFileSync(
  "src/pages/admin/sections/publishing/ImportsHub.tsx",
  "utf8",
) as string;
const LEGACY = readFileSync(
  "src/pages/admin/sections/publishing/LegacyMigrationPreview.tsx",
  "utf8",
) as string;

describe("Admin V2 Imports Hub — route wiring", () => {
  it("hub route is bound to ImportsHub, not LegacyMigrationPreview", () => {
    expect(ELEMENTS).toMatch(
      /publishingImports:\s*wrap\(<ImportsHub\s*\/>\)/,
    );
    expect(ELEMENTS).toMatch(
      /publishingImportsLegacy:\s*wrap\(<LegacyMigrationPreview\s*\/>\)/,
    );
  });

  it("all four import routes are registered in App.tsx", () => {
    expect(APP).toMatch(
      /path="publishing\/imports"\s+element=\{adminSectionElements\.publishingImports\}/,
    );
    expect(APP).toMatch(
      /path="publishing\/imports\/legacy"\s+element=\{adminSectionElements\.publishingImportsLegacy\}/,
    );
    expect(APP).toMatch(
      /path="publishing\/imports\/json"\s+element=\{adminSectionElements\.publishingImportsJson\}/,
    );
    expect(APP).toMatch(
      /path="publishing\/imports\/ai-studio"\s+element=\{adminSectionElements\.publishingImportsAiStudio\}/,
    );
  });
});

describe("Admin V2 Imports Hub — card contract", () => {
  it("exposes exactly three cards with the required destinations", () => {
    const dests = IMPORTS_HUB_CARDS.map((c) => c.to).sort();
    expect(dests).toEqual([
      "/admin/publishing/imports/ai-studio",
      "/admin/publishing/imports/json",
      "/admin/publishing/imports/legacy",
    ]);
  });

  it("uses the exact primary English labels", () => {
    const byKey = Object.fromEntries(IMPORTS_HUB_CARDS.map((c) => [c.key, c]));
    expect(byKey.json.title).toBe("JSON Importer");
    expect(byKey["ai-studio"].title).toBe("AI Studio");
    expect(byKey.legacy.title).toBe("Legacy migration verification");
  });

  it("uses the exact primary English descriptions", () => {
    const byKey = Object.fromEntries(IMPORTS_HUB_CARDS.map((c) => [c.key, c]));
    expect(byKey.json.description).toBe(
      "Import V2 resources from validated JSON.",
    );
    expect(byKey["ai-studio"].description).toBe(
      "Generate/prepare resources through the unified publisher workflow.",
    );
    expect(byKey.legacy.description).toBe(
      "Read-only historical verification/audit.",
    );
  });

  it("provides bilingual Arabic labels/descriptions for every card", () => {
    for (const c of IMPORTS_HUB_CARDS) {
      expect(c.titleAr.length).toBeGreaterThan(0);
      expect(c.descriptionAr.length).toBeGreaterThan(0);
    }
  });
});

describe("Admin V2 Imports Hub — accessibility / mobile / RTL", () => {
  it("hub is a single H1 titled 'Imports'", () => {
    expect(HUB).toMatch(/<h1[^>]*>\s*Imports/);
    // No second H1 in the same file.
    const h1Count = (HUB.match(/<h1\b/g) ?? []).length;
    expect(h1Count).toBe(1);
  });

  it("hub layout stacks to one column on mobile", () => {
    expect(HUB).toMatch(/grid-cols-1/);
    expect(HUB).toMatch(/sm:grid-cols-2/);
  });

  it("hub cards enforce a 44px minimum touch target", () => {
    // min-h-[44px] appears on both the Link wrapper and Card.
    const hits = (HUB.match(/min-h-\[44px\]/g) ?? []).length;
    expect(hits).toBeGreaterThanOrEqual(2);
  });

  it("hub cards are keyboard/screen-reader accessible", () => {
    expect(HUB).toMatch(/aria-label=/);
    expect(HUB).toMatch(/focus-visible:ring/);
    // Directional cue is aria-hidden so screen readers don't announce it.
    expect(HUB).toMatch(/ArrowRight[\s\S]{0,200}aria-hidden/);
  });

  it("hub follows app language direction (dir={dir})", () => {
    expect(HUB).toMatch(/dir=\{dir\}/);
    // Arrow flips in RTL.
    expect(HUB).toMatch(/rtl:rotate-180/);
  });
});

describe("Admin V2 Imports Hub — no execution actions on the hub", () => {
  const FORBIDDEN = [
    { name: "form submission", re: /<form\b/ },
    { name: "button element", re: /<button\b/i },
    { name: "shadcn Button import", re: /from\s+["']@\/components\/ui\/button["']/ },
    { name: "onClick handler", re: /onClick=/ },
    { name: "onSubmit handler", re: /onSubmit=/ },
    { name: "supabase.functions.invoke", re: /functions\.invoke\(/ },
    { name: "supabase mutation", re: /\.from\(["'][^"']+["']\)\.(insert|update|delete|upsert)\(/ },
    { name: "useMutation", re: /useMutation\(/ },
    { name: "file input", re: /type=["']file["']/ },
  ];
  for (const { name, re } of FORBIDDEN) {
    it(`hub source contains no ${name}`, () => {
      expect({ name, matched: re.test(HUB) }).toEqual({ name, matched: false });
    });
  }
});

describe("Admin V2 Imports — legacy verification page preserved", () => {
  it("legacy page still renders under its verification-safe H1", () => {
    expect(LEGACY).toMatch(
      /Legacy migration verification\s*\/\s*التحقّق من الترحيل القديم/,
    );
  });

  it("legacy page keeps the 'Execute migration is disabled' banner", () => {
    expect(LEGACY).toMatch(/Execute migration is disabled/);
    expect(LEGACY).toMatch(/تنفيذ الترحيل معطّل/);
  });

  it("legacy page renders a breadcrumb back to Imports", () => {
    expect(LEGACY).toMatch(/aria-label="Breadcrumb"/);
    expect(LEGACY).toMatch(
      /to="\/admin\/publishing\/imports"[\s\S]{0,400}Imports/,
    );
    expect(LEGACY).toMatch(/aria-current="page"[\s\S]{0,120}Legacy migration verification/);
  });
});
