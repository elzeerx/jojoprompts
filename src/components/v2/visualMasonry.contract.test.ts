import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const explore = readFileSync(
  "src/pages/v2/ExploreCatalogContent.tsx",
  "utf8",
);
const card = readFileSync("src/components/v2/VisualResourceCard.tsx", "utf8");

describe("V2 visual masonry contract", () => {
  it("uses two mobile columns, three desktop columns and 12/16px gaps", () => {
    expect(explore).toContain(
      'className="columns-2 gap-3 md:columns-3 md:gap-4"',
    );
    expect(explore).toContain('data-testid="visual-masonry"');
  });

  it("keeps each visual card intact and uses varied visual proportions", () => {
    expect(card).toContain("break-inside-avoid");
    expect(card).toContain('"aspect-[4/5]"');
    expect(card).toContain('"aspect-[3/4]"');
    expect(card).toContain('"aspect-[4/3]"');
  });

  it("shows an unobstructed image with no overlays or metadata footer", () => {
    expect(card.includes("absolute inset-x-0 bottom-0")).toBe(false);
    expect(card.includes("bg-gradient-to-t")).toBe(false);
    expect(card.includes('data-testid="version-label"')).toBe(false);
    expect(card.includes('data-testid="updated-on"')).toBe(false);
    expect(card.includes("trustBadge")).toBe(false);
    expect(card.includes("quickPreview")).toBe(false);
  });

  it("renders a quiet editorial caption below the image", () => {
    expect(card).toContain('data-testid="caption-title"');
    expect(card).toContain('data-testid="caption-type"');
    expect(card).toContain('data-testid="visual-card-media"');
    expect(card).toContain('data-testid="visual-resource-caption"');
  });

  it("stacks the caption on narrow cards and uses two columns at sm+", () => {
    expect(card).toContain("grid grid-cols-1");
    expect(card).toContain("sm:grid-cols-[minmax(0,1fr)_auto]");
    expect(card).toContain("justify-self-start sm:justify-self-end");
    expect(card.includes("flex items-start justify-between")).toBe(false);
  });

  it("keeps every caption action at least 44px high", () => {
    expect(card).toContain("min-h-[44px]");
  });

  it("localizes visual resource type labels and avoids raw enum values", () => {
    expect(card).toContain("image_style:");
    expect(card).toContain("نمط صورة");
    expect(card).toContain("برومبت");
    expect(card).toContain("حزمة برومبتات");
    expect(card).toContain("Image style");
    expect(card).toContain("Prompt pack");
  });

  it("uses the concise lifetime label instead of the long copy", () => {
    expect(card).toContain('"ضمن الوصول"');
    expect(card).toContain('"Included"');
    expect(card.includes("includedLifetime")).toBe(false);
  });

  it("localizes the price suffix for both languages", () => {
    expect(card).toContain("د.ك");
    expect(card).toContain("KD");
  });
});

