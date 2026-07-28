/**
 * Contract for the active V2 taxonomy route:
 * - catalog classification only, with no subscription gate
 * - recoverable visibility toggles instead of permanent deletion
 * - mobile-sized primary controls
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

function read(rel: string): string {
  return readFileSync(rel, "utf8");
}

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const management = stripComments(
  read("src/pages/admin/components/categories/CategoriesManagement.tsx"),
);
const table = stripComments(
  read("src/pages/admin/components/categories/CategoriesTable.tsx"),
);
const dialog = stripComments(
  read("src/pages/admin/components/categories/CategoryDialog.tsx"),
);
const activeSurface = `${management}\n${table}\n${dialog}`;

describe("V2 taxonomy route contract", () => {
  it("uses catalog classification language without subscription gating", () => {
    expect(management).toContain("Organize the V2 catalog");
    expect(activeSurface).not.toMatch(/required[_ ]plan|subscription|tier/i);
  });

  it("does not expose permanent category deletion", () => {
    expect(activeSurface).not.toMatch(/deleteCategory|onDelete|Trash2|Delete category/i);
    expect(table).toContain("onToggleActive");
    expect(table).toContain("Deactivate");
    expect(dialog).toContain("Visible in catalog");
  });

  it("keeps the essential taxonomy fields and accessible controls", () => {
    expect(dialog).toContain("Catalog path");
    expect(dialog).toContain("Filter labels");
    expect(dialog).toContain("Display order");
    expect(dialog).toContain("min-h-[44px]");
    expect(management).toContain("min-h-[44px]");
    expect(table).toContain("min-w-[44px]");
  });
});
