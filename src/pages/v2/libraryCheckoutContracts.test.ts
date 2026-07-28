import { describe, expect, it } from "bun:test";

declare const require: (moduleName: string) => {
  readFileSync: (path: string, encoding: string) => string;
};
const { readFileSync } = require("fs");
const { resolve } = require("path");

const HERE = (import.meta as unknown as { dir?: string }).dir ?? ".";
const library = readFileSync(resolve(HERE, "LibraryPage.tsx"), "utf8");
const checkout = readFileSync(resolve(HERE, "V2CheckoutPage.tsx"), "utf8");

describe("My Library V2 contract", () => {
  it("provides search, finite progressive disclosure, and receipts access", () => {
    expect(library.includes('id="library-search"')).toBe(true);
    expect(library.includes("const PAGE_SIZE = 20")).toBe(true);
    expect(library.includes('to="/orders"')).toBe(true);
    expect(library.includes("visibleCount < filtered.length")).toBe(true);
  });

  it("shows version, guide, license, and update metadata", () => {
    expect(
      library.includes("current_version:latest_published_version_id"),
    ).toBe(true);
    expect(library.includes("installation_guides(id)")).toBe(true);
    expect(library.includes("licenses(id,license_key)")).toBe(true);
    expect(library.includes("update_info_en")).toBe(true);
  });

  it("does not label ordinary copyable prompts as missing packages", () => {
    expect(
      library.includes(
        'r.type === "skill" || r.type === "automation" || r.type === "bundle"',
      ),
    ).toBe(true);
    expect(library.includes("expectsPackage ?")).toBe(true);
  });
});

describe("Checkout accessibility and responsive contract", () => {
  it("keeps the empty state inside a main landmark with an H1", () => {
    const emptyBranch = checkout.slice(
      checkout.indexOf("if (cart.items.length === 0)"),
      checkout.indexOf('return (\\n    <div className="min-h-[70vh]"', checkout.indexOf("if (cart.items.length === 0)") + 1),
    );
    expect(emptyBranch.includes("<main")).toBe(true);
    expect(emptyBranch.includes("<h1")).toBe(true);
  });

  it("lets payment badges wrap on narrow viewports", () => {
    expect(checkout.includes("flex flex-wrap items-center gap-2 rounded-lg")).toBe(true);
    expect(checkout.includes('className="ms-auto flex flex-wrap gap-2"')).toBe(true);
  });
});
