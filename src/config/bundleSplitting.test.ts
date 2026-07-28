import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const HERE = (import.meta as unknown as { dir?: string }).dir ?? ".";
const viteConfig = readFileSync(resolve(HERE, "../../vite.config.ts"), "utf8");

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
});
