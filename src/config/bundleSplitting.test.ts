import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const HERE = (import.meta as unknown as { dir?: string }).dir ?? ".";
const viteConfig = readFileSync(resolve(HERE, "../../vite.config.ts"), "utf8");
const exploreShell = readFileSync(
  resolve(HERE, "../pages/v2/ExplorePage.tsx"),
  "utf8",
);
const exploreCatalog = readFileSync(
  resolve(HERE, "../pages/v2/ExploreCatalogContent.tsx"),
  "utf8",
);
const indexHtml = readFileSync(resolve(HERE, "../../index.html"), "utf8");

describe("V2 production bundle splitting", () => {
  it("separates core framework, data, and route-only heavy dependencies", () => {
    for (const chunk of [
      "vendor-react",
      "vendor-data",
      "vendor-forms",
      "vendor-charts",
      "vendor-content",
      "vendor-pdf",
    ]) {
      expect(viteConfig.includes(`return "${chunk}"`)).toBe(true);
    }
  });

  it("keeps route-owned application modules eligible for normal lazy splitting", () => {
    expect(viteConfig.includes('if (!id.includes("node_modules")) return undefined')).toBe(true);
  });

  it("renders the Explore title shell before loading catalog data and cards", () => {
    expect(exploreShell).toContain(
      'lazy(() => import("./ExploreCatalogContent"))',
    );
    expect(exploreShell).toContain("<h1");
    expect(exploreShell).toContain("V2_COPY.explore.subtitle");
    expect(exploreShell).not.toContain("useInfiniteExploreResources");
    expect(exploreShell).not.toContain("SkillResourceCard");

    expect(exploreCatalog).toContain("useInfiniteExploreResources");
    expect(exploreCatalog).toContain("SkillResourceCard");
  });

  it("preloads the LCP font and excludes the Lovable editor helper from production HTML", () => {
    expect(indexHtml).toMatch(
      /rel=["']preload["'][\s\S]*?FormaDJRArabicText-Regular\.woff2/,
    );
    expect(indexHtml).not.toContain("cdn.gpteng.co");
    expect(indexHtml).not.toContain("gptengineer.js");
  });
});
