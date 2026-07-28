/**
 * Mobile 44x44 touch-target contract for shared UI primitives.
 *
 * The 390x844 live audit found that Button(sm), Input, Checkbox, Switch and
 * TabsTrigger rendered smaller than 44px on mobile. This contract locks the
 * fix by asserting that each primitive's ACTUAL interactive root (not a
 * decorative pseudo-element) reserves >= 44px on mobile, while md+ keeps the
 * original compact desktop density.
 */
import { describe, it, expect } from "bun:test";

declare const require: (m: string) => {
  readFileSync(p: string, enc: string): string;
};

function read(rel: string): string {
  const fs = require("fs");
  return fs.readFileSync(rel, "utf8");
}

describe("shared primitive mobile touch-target contract", () => {
  it("Input root is >=44px on mobile and 40px on md+", () => {
    const src = read("src/components/ui/input.tsx");
    expect(/h-11\s+md:h-10/.test(src)).toBe(true);
  });

  it("Button size=sm root is >=44px on mobile and 36px on md+", () => {
    const src = read("src/components/ui/button.tsx");
    expect(/sm:\s*"h-9 px-3 min-h-\[44px\] md:min-h-\[36px\]"/.test(src)).toBe(
      true,
    );
  });

  it("Checkbox root itself grows to 44x44 on mobile (not a pseudo-element)", () => {
    const src = read("src/components/ui/checkbox.tsx");
    // The Root gets the h-11 w-11 sizing directly — that is the tappable node.
    expect(/CheckboxPrimitive\.Root[\s\S]*?h-11 w-11 md:h-4 md:w-4/.test(src)).toBe(
      true,
    );
    // Visible tick square is inner (16x16) and pointer-events-none so events
    // stay on the Root.
    expect(/pointer-events-none[\s\S]*?h-4 w-4[\s\S]*?border border-primary/.test(src)).toBe(
      true,
    );
    // No `after:` / `before:` hit-area hacks masquerading as the target.
    expect(/after:absolute|before:absolute/.test(src)).toBe(false);
  });

  it("Switch root itself grows to 44px tall on mobile (not a pseudo-element)", () => {
    const src = read("src/components/ui/switch.tsx");
    expect(/SwitchPrimitives\.Root[\s\S]*?h-11 md:h-6 w-11/.test(src)).toBe(true);
    // The visible pill remains 24x44 inside a pointer-events-none span.
    expect(/pointer-events-none[\s\S]*?h-6 w-11[\s\S]*?rounded-full/.test(src)).toBe(
      true,
    );
    expect(/after:absolute|before:absolute/.test(src)).toBe(false);
  });

  it("TabsList and TabsTrigger are >=44px on mobile and compact on md+", () => {
    const src = read("src/components/ui/tabs.tsx");
    expect(/min-h-\[44px\] md:min-h-10 md:h-10/.test(src)).toBe(true); // List
    expect(/min-h-\[44px\] md:min-h-8/.test(src)).toBe(true); // Trigger
  });

  it("AdminTopBar breadcrumb Admin link reserves 44px height on mobile", () => {
    const src = read("src/pages/admin/layout/AdminTopBar.tsx");
    // The Link IS the tappable element; sizing lives on the Link className.
    expect(
      /<Link[\s\S]*?to="\/admin"[\s\S]*?className="[^"]*min-h-\[44px\][^"]*md:min-h-0/.test(
        src,
      ),
    ).toBe(true);
  });

  it("Admin shell provides a keyboard skip link to the focusable main region", () => {
    const src = read("src/pages/admin/layout/AdminLayout.tsx");
    expect(src.includes('href="#admin-main-content"')).toBe(true);
    expect(src.includes("Skip to admin content")).toBe(true);
    expect(src.includes('id="admin-main-content"')).toBe(true);
    expect(src.includes("tabIndex={-1}")).toBe(true);
  });

  it("ResourcePublisher remove product button is 44x44 on mobile", () => {
    const src = read("src/pages/admin/sections/publishing/ResourcePublisher.tsx");
    expect(
      /aria-label="Remove product"[\s\S]*?min-h-\[44px\] min-w-\[44px\]/.test(src),
    ).toBe(true);
  });

  it("Recovery commerce-integrity refresh is 44x44 and labelled", () => {
    const src = read("src/pages/admin/sections/orders/RecoveryPage.tsx");
    expect(src.includes('className="min-h-[44px] min-w-[44px]"')).toBe(true);
    expect(src.includes('aria-label="Refresh commerce integrity"')).toBe(true);
  });

  it("Security Events uses the shared 44x44 Checkbox root", () => {
    const src = read("src/components/admin/SecurityMonitoringDashboard.tsx");
    expect(src.includes('import { Checkbox } from "@/components/ui/checkbox"')).toBe(
      true,
    );
    expect(src.includes('id="include-all-security-events"')).toBe(true);
    expect(src.includes('type="checkbox"')).toBe(false);
  });
});
