import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const explore = readFileSync(
  "src/pages/v2/ExploreCatalogContent.tsx",
  "utf8",
);
const card = readFileSync("src/components/v2/VisualResourceCard.tsx", "utf8");

describe("V2 visual masonry contract", () => {
  it("uses two mobile columns and expands on larger screens", () => {
    expect(explore).toContain(
      'className="columns-2 gap-3 md:columns-3 lg:columns-4"',
    );
    expect(explore).toContain('data-testid="visual-masonry"');
  });

  it("keeps each visual card intact and uses varied visual proportions", () => {
    expect(card).toContain("break-inside-avoid");
    expect(card).toContain(
      'className="relative block overflow-hidden',
    );
    expect(card).toContain('"aspect-[4/5]"');
    expect(card).toContain('"aspect-[3/4]"');
    expect(card).toContain('"aspect-[4/3]"');
  });
});
