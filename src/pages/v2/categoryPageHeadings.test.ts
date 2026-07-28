/**
 * Category page H1 localization contract. Prevents regression of the
 * "English-only heading in Arabic mode" runtime bug by asserting that
 * every category page hands ExplorePage a bilingual title object.
 */
import { describe, it, expect } from "bun:test";

const PAGES = [
  { file: "SkillsPage.tsx", en: "Skills", ar: "المهارات" },
  { file: "AutomationsPage.tsx", en: "Automations", ar: "الأتمتة" },
  { file: "PromptsCatalogPage.tsx", en: "Prompts", ar: "البرومبتات" },
  { file: "ImageStylesPage.tsx", en: "Image Styles", ar: "أنماط الصور" },
  { file: "BundlesPage.tsx", en: "Bundles", ar: "الحزم" },
];

describe("category page H1 localization", () => {
  for (const p of PAGES) {
    it(`${p.file} passes a bilingual title object`, async () => {
      // Bun-native file read; avoids requiring @types/node in the TS project.
      // Bun-native file read; avoids requiring @types/node in the TS project.
      const bun = (globalThis as unknown as {
        Bun: { file: (p: string) => { text: () => Promise<string> } };
      }).Bun;
      const src = await bun.file(`src/pages/v2/${p.file}`).text();


      expect(/title=\{\s*\{[^}]*en:/.test(src)).toBe(true);
      expect(src.includes(`en: "${p.en}"`)).toBe(true);
      expect(src.includes(`ar: "${p.ar}"`)).toBe(true);
    });
  }
});
