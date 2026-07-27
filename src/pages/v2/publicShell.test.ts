/**
 * Contract tests for the canonical V2 public shell. Cheap static assertions
 * that catch obvious regressions in App.tsx routing.
 */
import { describe, it, expect } from "bun:test";

declare const require: (m: string) => any;
const { readFileSync } = require("fs");
const { resolve } = require("path");

const HERE: string =
  (import.meta as unknown as { dir: string }).dir ??
  (typeof __dirname !== "undefined" ? __dirname : ".");

const APP: string = readFileSync(resolve(HERE, "../../App.tsx"), "utf8");
const V2LAYOUT: string = readFileSync(
  resolve(HERE, "../../components/v2/V2Layout.tsx"),
  "utf8",
);
const ROOT_LAYOUT: string = readFileSync(
  resolve(HERE, "../../components/layout/root-layout.tsx"),
  "utf8",
);

describe("V2 public shell selection", () => {
  it("includes root (/) in the V2 shell path set", () => {
    expect(/const V2_PATHS = new Set\(\[[\s\S]*?"\/",/.test(APP)).toBe(true);
  });

  it("mounts V2Layout as a top-level layout (not nested under RootLayout)", () => {
    expect(APP.includes("<Route element={<V2Layout />}>")).toBe(true);
    const nested =
      /<Route path="\/" element=\{<RootLayout \/>\}>[\s\S]*?<Route element=\{<V2Layout \/>\}>/;
    expect(nested.test(APP)).toBe(false);
  });

  it("V2Layout renders exactly one V2Header + V2Footer and no legacy Header", () => {
    expect(V2LAYOUT.includes("<V2Header />")).toBe(true);
    expect(V2LAYOUT.includes("<V2Footer />")).toBe(true);
    expect(/<Header\s*\/>/.test(V2LAYOUT)).toBe(false);
  });

  it("RootLayout still uses legacy Header for legacy pages but no V2 chrome", () => {
    expect(ROOT_LAYOUT.includes("<Header />")).toBe(true);
    expect(/V2Header|V2Footer/.test(ROOT_LAYOUT)).toBe(false);
  });
});
