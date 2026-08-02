import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const sheet = readFileSync("src/components/v2/QuickPreviewSheet.tsx", "utf8");
const card = readFileSync("src/components/v2/VisualResourceCard.tsx", "utf8");

describe("quick preview accessibility contract", () => {
  it("renders a visually hidden localized SheetTitle and SheetDescription", () => {
    expect(sheet).toContain("SheetTitle");
    expect(sheet).toContain("SheetDescription");
    expect(sheet).toContain('<SheetTitle className="sr-only">{sheetTitle}</SheetTitle>');
    expect(sheet).toContain(
      '<SheetDescription className="sr-only">{sheetDescription}</SheetDescription>',
    );
    expect(sheet).toContain("معاينة سريعة");
  });

  it("passes a localized close label to the sheet content", () => {
    expect(sheet).toContain("closeLabel={closeLabel}");
    expect(sheet).toContain('"إغلاق المعاينة" : "Close preview"');
  });

  it("gives the card image a localized accessible name and preview/link fallback", () => {
    expect(card).toContain("previewLabel");
    expect(card).toContain("detailsLabel");
    expect(card).toContain("معاينة سريعة");
    expect(card).toContain("onQuickPreview(r.id)");
    expect(card).toContain("to={`/resources/${r.slug}`}");
  });
});
