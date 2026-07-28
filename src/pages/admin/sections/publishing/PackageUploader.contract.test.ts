import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  RESOURCE_EDITOR_SELECT,
  buildResourceEditUrl,
} from "./ResourcePublisher";

const readFile = (rel: string) =>
  readFileSync(resolve(process.cwd(), rel), "utf8");

const UUID = "766f3370-d38c-42e5-8566-5e4946986dd2";

describe("ResourcePublisher — resource editor select", () => {
  it("must not embed product_bundle_items via bundle_product_id from resources", () => {
    // resources → product_bundle_items has NO direct FK on bundle_product_id.
    // Embedding that hint from `resources` returns HTTP 400 from PostgREST.
    expect(RESOURCE_EDITOR_SELECT).not.toContain("product_bundle_items");
    expect(RESOURCE_EDITOR_SELECT).not.toContain("bundle_product_id");
  });

  it("still embeds the resource's own products so bundle items can be loaded via product ids", () => {
    expect(RESOURCE_EDITOR_SELECT).toContain(
      "products(id,sku,product_type,title_en,price_fils,is_active)",
    );
  });

  it("generates the canonical catalog → publisher edit URL", () => {
    expect(buildResourceEditUrl(UUID)).toBe(
      `/admin/publishing/resources/${UUID}/edit`,
    );
  });
});

describe("PackageUploader — V2 upload contract", () => {
  const src = readFile("src/pages/admin/sections/publishing/PackageUploader.tsx");

  it("invokes only v2-admin-upload-resource-file, never admin-package-upload", () => {
    expect(src).toContain("v2-admin-upload-resource-file");
    expect(src).not.toContain("admin-package-upload");
    expect(src).not.toMatch(/create_upload|finalize_upload/);
  });

  it("does not select storage_path on the client", () => {
    // storage_path leaks internal layout; V2 UI must not fetch it.
    expect(src).not.toContain("storage_path");
  });

  it("renders a visible label bound to the file input", () => {
    expect(src).toContain('htmlFor={inputId}');
    expect(src).toContain('id={inputId}');
    expect(src).toContain("Choose a package file");
  });

  it("announces busy/progress state with aria-live and aria-busy", () => {
    expect(src).toContain('aria-busy={busy}');
    expect(src).toContain('aria-live="polite"');
  });

  it("keeps a reset control and clears the input ref", () => {
    expect(src).toContain("resetInput");
    expect(src).toContain('inputRef.current.value = ""');
  });

  it("preserves 44px minimum touch target on interactive controls", () => {
    expect(src).toContain('min-h-[44px]');
  });

  it("uses RTL-safe logical spacing utilities (me-* / ms-*)", () => {
    expect(src).toMatch(/\bme-2\b/);
    expect(src).toMatch(/\bms-3\b/);
  });
});

describe("PackageUploader — active publisher chain has no legacy caller", () => {
  it("ResourcePublisher does not invoke admin-package-upload directly", () => {
    const src = readFile("src/pages/admin/sections/publishing/ResourcePublisher.tsx");
    expect(src).not.toContain("admin-package-upload");
  });
});
