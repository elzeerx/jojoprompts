/**
 * PaginationSection mobile touch-target + overflow contract.
 * Live 390x844 QA found 36px controls; V2 requires >=44px and no
 * page-level horizontal overflow at 390px.
 */
import { describe, it, expect } from "bun:test";

declare const require: (m: string) => any;

function read(rel: string): string {
  const fs = require("fs") as { readFileSync(p: string, enc: string): string };
  return fs.readFileSync(rel, "utf8");
}

const raw = read(
  "src/pages/admin/components/users/components/PaginationSection.tsx",
);
const source = raw
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("PaginationSection mobile contract", () => {
  it("applies min 44x44 to every control via a shared class", () => {
    expect(/CONTROL_CLASSES/.test(source)).toBe(true);
    expect(/min-h-\[44px\]/.test(source)).toBe(true);
    expect(/min-w-\[44px\]/.test(source)).toBe(true);
    // Both boundary buttons and every numeric button reuse the shared classes.
    const controlMatches = source.match(/className=\{CONTROL_CLASSES\}/g) ?? [];
    expect(controlMatches.length >= 3).toBe(true);
    // Ellipsis span also honors 44px so tap targets stay stable.
    expect(/inline-flex[^"]*min-h-\[44px\][^"]*min-w-\[44px\]/.test(source)).toBe(
      true,
    );
  });

  it("uses flex-wrap so pagination cannot cause 390px overflow", () => {
    expect(/flex-wrap/.test(source)).toBe(true);
    // Row must not be a fixed-width, non-wrapping horizontal stack.
    expect(/space-x-2/.test(source)).toBe(false);
    // Uses gap for spacing between wrapped controls.
    expect(/gap-2/.test(source)).toBe(true);
  });

  it("preserves keyboard/disabled semantics", () => {
    expect(/disabled=\{currentPage === 1\}/.test(source)).toBe(true);
    expect(/disabled=\{currentPage === totalPages\}/.test(source)).toBe(true);
    expect(/aria-label="Previous page"/.test(source)).toBe(true);
    expect(/aria-label="Next page"/.test(source)).toBe(true);
    expect(/aria-current=\{currentPage === page \? "page" : undefined\}/.test(source)).toBe(
      true,
    );
  });
});
