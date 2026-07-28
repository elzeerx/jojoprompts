/**
 * Contract tests: V2 protected legacy content is entitlement-gated.
 * - useResourceDetail must never select protected prompt columns.
 * - useEntitledResourceContent is enabled only for signed-in owners.
 * - V2Header/V2Footer call useAuth unconditionally at the top level.
 * - ResourceDetailPage renders the "Your prompt" section only when the
 *   resource is owned AND has a legacy_prompt_id.
 */
import { describe, it, expect } from "bun:test";

declare const require: (m: string) => unknown;
const { readFileSync } = require("fs") as {
  readFileSync: (path: string, encoding: string) => string;
};
const { resolve } = require("path") as {
  resolve: (...paths: string[]) => string;
};

const HERE: string = (import.meta as unknown as { dir?: string }).dir ?? ".";
const read = (rel: string) => readFileSync(resolve(HERE, rel), "utf8") as string;

const DETAIL_HOOK = read("./useResourceDetail.ts");
const ENTITLED_HOOK = read("./useEntitledResourceContent.ts");
const HEADER = read("../../components/v2/V2Header.tsx");
const FOOTER = read("../../components/v2/V2Footer.tsx");
const PAGE = read("../../pages/v2/ResourceDetailPage.tsx");

describe("V2 protected-content wiring", () => {
  it("useResourceDetail selects explicit safe columns and never queries protected prompt text", () => {
    expect(DETAIL_HOOK.includes('select("*")')).toBe(false);
    expect(DETAIL_HOOK.includes("prompt_text")).toBe(false);
    expect(DETAIL_HOOK.includes("prompt_text_ar")).toBe(false);
    expect(DETAIL_HOOK).toContain("hero_image_path");
    expect(DETAIL_HOOK).toContain("legacy_prompt_id");
  });

  it("useResourceDetail matches the promoted V2 schema and fails loudly on related-query errors", () => {
    expect(DETAIL_HOOK).toContain("published_at, created_at, updated_at");
    expect(DETAIL_HOOK).not.toContain("released_at");
    expect(DETAIL_HOOK).toContain("notes_en, notes_ar, is_verified");
    expect(DETAIL_HOOK).not.toMatch(/min_version,\s*notes[";]/);
    expect(DETAIL_HOOK).toContain("if (result.error) throw result.error");
  });

  it("useEntitledResourceContent is disabled unless signed-in + owned", () => {
    expect(ENTITLED_HOOK).toContain("!!user && !!resourceId && owned === true");
    expect(ENTITLED_HOOK).toContain("v2_get_entitled_resource_content");
  });

  it("V2Header uses useAuth unconditionally (no try/catch wrapper)", () => {
    expect(HEADER).toMatch(
      /const\s*\{\s*user\s*,\s*isAdmin\s*,\s*signOut\s*\}\s*=\s*useAuth\(\)/,
    );
    expect(/try\s*\{[^}]*useAuth\(\)/.test(HEADER)).toBe(false);
  });

  it("V2Footer uses useAuth unconditionally (no try/catch wrapper)", () => {
    expect(FOOTER).toMatch(/const\s*\{\s*user\s*\}\s*=\s*useAuth\(\)/);
    expect(/try\s*\{[^}]*useAuth\(\)/.test(FOOTER)).toBe(false);
  });

  it("ResourceDetailPage gates the Your prompt section on ownership + legacy_prompt_id", () => {
    expect(PAGE).toContain("shouldFetchProtected");
    expect(PAGE).toContain("legacy_prompt_id");
    expect(PAGE).toContain("useEntitledResourceContent");
    expect(PAGE).toContain('data-testid="entitled-prompt-section"');
  });

  it("ResourceDetailPage distinguishes Lifetime inclusion and always explains license, updates, and support", () => {
    expect(PAGE).toContain("includedLifetime");
    expect(PAGE).toContain("lifetimeActiveCallout");
    expect(PAGE).toContain("standardLicenseTerms");
    expect(PAGE).toContain("standardUpdates");
    expect(PAGE).toContain("standardSupport");
  });
});
