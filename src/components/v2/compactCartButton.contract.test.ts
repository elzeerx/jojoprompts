import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const button = readFileSync("src/components/v2/AddToCartButton.tsx", "utf8");
const card = readFileSync("src/components/v2/VisualResourceCard.tsx", "utf8");

describe("compact add-to-cart control contract", () => {
  it("exposes optional appearance and priceLabel props without changing defaults", () => {
    expect(button).toContain('appearance?: "default" | "compact"');
    expect(button).toContain("priceLabel?: string");
    expect(button).toContain('appearance = "default"');
    expect(button).toContain('const compact = appearance === "compact"');
  });

  it("keeps a 44px minimum touch target", () => {
    expect(button).toContain("min-h-[44px]");
  });

  it("announces title and price on the compact control", () => {
    expect(button).toContain("compactAddLabel");
    expect(button).toContain("aria-label={compact ? compactAddLabel : undefined}");
    expect(button).toContain("priceLabel ?? t.add");
  });

  it("uses a concise bilingual in-cart state", () => {
    expect(button).toContain('inCart: lang === "ar" ? "في السلة" : "In cart"');
    expect(button).toContain("compact ? t.inCart : t.view");
  });

  it("retains cart idempotency", () => {
    expect(button).toContain("const inCart = cart.has(productId)");
    expect(button).toContain('reason === "duplicate"');
    expect(button).toContain('reason === "cap_reached"');
  });

  it("is used in compact appearance by visual cards", () => {
    expect(card).toContain('appearance="compact"');
    expect(card).toContain("priceLabel={priceLabel ?? undefined}");
  });
});
