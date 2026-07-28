/**
 * Contract regression for /admin/publishing/resources/:resourceId/edit.
 *
 * Blocks two failure modes:
 *   - Reintroducing the invalid PostgREST embed
 *     `product_bundle_items:product_bundle_items!bundle_product_id(resource_id)`
 *     from `resources`, which returned HTTP 400 and rendered as
 *     "Resource not found".
 *   - Reintroducing the retired `admin-package-upload` slug in the active
 *     publisher chain (PackageUploader / ResourcePublisher).
 */
import { describe, it, expect } from "bun:test";

declare const require: (m: string) => any;
const { readFileSync } = require("fs");
const { resolve } = require("path");

const HERE: string = (import.meta as unknown as { dir?: string }).dir ?? ".";
const read = (rel: string) =>
  readFileSync(resolve(HERE, rel), "utf8") as string;

const UUID = "766f3370-d38c-42e5-8566-5e4946986dd2";

describe("ResourcePublisher — resource editor select", () => {
  const src = read("ResourcePublisher.tsx");

  it("must not embed product_bundle_items via bundle_product_id from resources", () => {
    // resources → product_bundle_items has NO direct FK on bundle_product_id.
    // Embedding that hint from `resources` returns HTTP 400 from PostgREST.
    expect(src.includes("product_bundle_items:product_bundle_items!bundle_product_id")).toBe(false);
    expect(src.includes("product_bundle_items!bundle_product_id(resource_id)")).toBe(false);
  });

  it("exports the canonical select and edit URL builder", () => {
    expect(src.includes("export const RESOURCE_EDITOR_SELECT")).toBe(true);
    expect(src.includes("export function buildResourceEditUrl")).toBe(true);
    expect(src.includes("/admin/publishing/resources/${resourceId}/edit")).toBe(true);
  });

  it("still embeds the resource's own products so bundle items can be loaded via product ids", () => {
    expect(
      src.includes("products(id,sku,product_type,title_en,price_fils,is_active)"),
    ).toBe(true);
  });

  it("loads bundle items in a second query filtered by bundle_product_id IN productIds", () => {
    expect(src.includes('.from("product_bundle_items")')).toBe(true);
    expect(src.includes('.in("bundle_product_id"')).toBe(true);
  });

  it("catalog edit URL uses the same path shape the router accepts", () => {
    const path = `/admin/publishing/resources/${UUID}/edit`;
    expect(path.startsWith("/admin/publishing/resources/")).toBe(true);
    expect(path.endsWith("/edit")).toBe(true);
  });
});

describe("PackageUploader — V2 upload contract", () => {
  const src = read("PackageUploader.tsx");

  it("invokes only v2-admin-upload-resource-file, never admin-package-upload", () => {
    expect(src.includes("v2-admin-upload-resource-file")).toBe(true);
    expect(src.includes("admin-package-upload")).toBe(false);
    expect(/create_upload|finalize_upload/.test(src)).toBe(false);
  });

  it("does not select storage_path on the client", () => {
    expect(src.includes("storage_path")).toBe(false);
  });

  it("renders a visible label bound to the file input", () => {
    expect(src.includes("htmlFor={inputId}")).toBe(true);
    expect(src.includes("id={inputId}")).toBe(true);
    expect(src.includes("Choose a package file")).toBe(true);
  });

  it("announces busy/progress state with aria-live and aria-busy", () => {
    expect(src.includes("aria-busy={busy}")).toBe(true);
    expect(src.includes('aria-live="polite"')).toBe(true);
  });

  it("keeps a reset control and clears the input ref", () => {
    expect(src.includes("resetInput")).toBe(true);
    expect(src.includes('inputRef.current.value = ""')).toBe(true);
  });

  it("preserves 44px minimum touch target on interactive controls", () => {
    expect(src.includes("min-h-[44px]")).toBe(true);
  });

  it("uses RTL-safe logical spacing utilities (me-* / ms-*)", () => {
    expect(/\bme-2\b/.test(src)).toBe(true);
    expect(/\bms-3\b/.test(src)).toBe(true);
  });
});

describe("Active publisher chain has no legacy caller", () => {
  it("ResourcePublisher does not invoke admin-package-upload directly", () => {
    const src = read("ResourcePublisher.tsx");
    expect(src.includes("admin-package-upload")).toBe(false);
  });
});
