/**
 * Category page H1 localization contract. Prevents regression of the
 * "English-only heading in Arabic mode" runtime bug by asserting that
 * every category page hands ExplorePage a bilingual title object.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGES = [
  { file: "SkillsPage.tsx", en: "Skills", ar: "المهارات" },
  { file: "AutomationsPage.tsx", en: "Automations", ar: "الأتمتة" },
  { file: "PromptsCatalogPage.tsx", en: "Prompts", ar: "البرومبتات" },
  { file: "ImageStylesPage.tsx", en: "Image Styles", ar: "أنماط الصور" },
  { file: "BundlesPage.tsx", en: "Bundles", ar: "الحزم" },
];

describe("category page H1 localization", () => {
  for (const p of PAGES) {
    it(`${p.file} passes a bilingual title object`, () => {
      const src = readFileSync(resolve("src/pages/v2", p.file), "utf8");
      expect(src).toMatch(/title=\{\s*\{[^}]*en:/);
      expect(src).toContain(`en: "${p.en}"`);
      expect(src).toContain(`ar: "${p.ar}"`);
    });
  }
});
