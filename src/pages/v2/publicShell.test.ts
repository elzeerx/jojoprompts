import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Contract tests for the canonical V2 public shell. These are cheap static
 * assertions that catch obvious regressions in `App.tsx` routing without
 * having to render the full app.
 */
const APP = readFileSync(path.resolve(__dirname, "../../App.tsx"), "utf8");
const V2LAYOUT = readFileSync(
  path.resolve(__dirname, "../../components/v2/V2Layout.tsx"),
  "utf8",
);
const ROOT_LAYOUT = readFileSync(
  path.resolve(__dirname, "../../components/layout/root-layout.tsx"),
  "utf8",
);

describe("V2 public shell selection", () => {
  it("includes root (/) in the V2 shell path set", () => {
    expect(APP).toMatch(/const V2_PATHS = new Set\(\[[\s\S]*?"\/",/);
  });

  it("mounts V2Layout as a top-level layout (not nested under RootLayout)", () => {
    expect(APP).toMatch(/<Route element=\{<V2Layout \/>\}>/);
    // The V2Layout wrapper must not be nested inside a RootLayout route.
    const nested = /<Route path="\/" element=\{<RootLayout \/>\}>[\s\S]*?<Route element=\{<V2Layout \/>\}>/;
    expect(nested.test(APP)).toBe(false);
  });

  it("V2Layout renders one V2Header, one V2Footer, no legacy Header", () => {
    expect(V2LAYOUT).toMatch(/<V2Header \/>/);
    expect(V2LAYOUT).toMatch(/<V2Footer \/>/);
    expect(V2LAYOUT).not.toMatch(/\bHeader\b\s*\/>/);
  });

  it("RootLayout still exists for legacy pages but skips V2 chrome", () => {
    // Legacy RootLayout preserves its Header (for /about, /faq, etc.)
    expect(ROOT_LAYOUT).toMatch(/<Header \/>/);
    // But it does NOT render V2Header or V2Footer.
    expect(ROOT_LAYOUT).not.toMatch(/V2Header|V2Footer/);
  });
});
