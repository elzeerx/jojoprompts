/**
 * Contract tests for the V2 public homepage. Cheap static assertions to
 * catch regressions to legacy prompt-only copy or broken hash CTAs.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const HERE: string =
  (import.meta as unknown as { dir?: string }).dir ?? ".";

const HOMEPAGE: string = readFileSync(
  resolve(HERE, "../HomePage.tsx"),
  "utf8",
);
const HOW: string = readFileSync(
  resolve(HERE, "./HowItWorksPage.tsx"),
  "utf8",
);
const HEADER: string = readFileSync(
  resolve(HERE, "../../components/v2/V2Header.tsx"),
  "utf8",
);
const FOOTER: string = readFileSync(
  resolve(HERE, "../../components/v2/V2Footer.tsx"),
  "utf8",
);
const APP: string = readFileSync(resolve(HERE, "../../App.tsx"), "utf8");
const ROUTES: string = readFileSync(
  resolve(HERE, "../../config/routes.ts"),
  "utf8",
);
const EXPLORE_FILTERS: string = readFileSync(
  resolve(HERE, "../../components/v2/ExploreFiltersBar.tsx"),
  "utf8",
);

describe("V2 homepage contract", () => {
  it("does not reuse legacy fixed prompt-package copy", () => {
    for (const banned of [
      "ChatGPTPromptsPage",
      "MidjourneyPromptsPage",
      "GPTsBuilderPage",
      "WorkflowPromptsPage",
      "EnhancedHeroSection",
      "FeatureHighlights",
      "InteractiveDemo",
      "CategoryShowcase",
      "TrustSignals",
    ]) {
      expect(HOMEPAGE.includes(banned)).toBe(false);
    }
  });

  it("has no broken #pricing hash CTAs", () => {
    expect(HOMEPAGE.includes('"#pricing"')).toBe(false);
    expect(HOMEPAGE.includes("'#pricing'")).toBe(false);
  });

  it("links to /how-it-works and /explore from the homepage", () => {
    expect(HOMEPAGE.includes('to="/how-it-works"')).toBe(true);
    expect(HOMEPAGE.includes('to="/explore"')).toBe(true);
  });

  it("declares the skills-first hero and platform-compatibility copy", () => {
    expect(/skills, automations|Skills, automations|AI skills/i.test(HOMEPAGE)).toBe(true);
    expect(HOMEPAGE.includes("V2_PLATFORMS")).toBe(true);
    expect(/Full Library Lifetime|Jojo Full Library/.test(HOMEPAGE)).toBe(true);
  });

  it("personalizes featured cards for lifetime and individually owned resources", () => {
    expect(HOMEPAGE.includes("useLibraryState")).toBe(true);
    expect(HOMEPAGE.includes("library?.has_library_access")).toBe(true);
    expect(HOMEPAGE.includes('("library" as const)')).toBe(true);
    expect(HOMEPAGE.includes('("resource" as const)')).toBe(true);
  });

  it("exposes an in-page id=how-it-works overview section", () => {
    expect(/id="how-it-works"/.test(HOMEPAGE)).toBe(true);
  });
});

describe("/how-it-works route + shell", () => {
  it("is registered as a V2 route", () => {
    expect(ROUTES.includes('path: "how-it-works"')).toBe(true);
    expect(ROUTES.includes("V2HowItWorksPage")).toBe(true);
  });
  it("renders inside the canonical V2Layout shell (no allowlist)", () => {
    // V2_PATHS is retired — every non-admin route now renders under V2Layout.
    expect(APP.includes("<Route element={<V2Layout />}>")).toBe(true);
    expect(APP.includes("V2_PATHS")).toBe(false);
  });

  it("renders bilingual copy and 44px CTAs", () => {
    expect(HOW.includes("min-h-[44px]")).toBe(true);
    expect(/كيف يعمل/.test(HOW)).toBe(true);
  });
});

describe("V2 header/footer navigation", () => {
  it("desktop header exposes a How It Works link", () => {
    expect(HEADER.includes('to: "/how-it-works"')).toBe(true);
  });
  it("footer exposes How It Works", () => {
    expect(FOOTER.includes('"/how-it-works"')).toBe(true);
  });
  it("footer sign-in link is hidden for authenticated visitors", () => {
    // Two branches: authed → no /login entry; unauthed → includes /login.
    expect(FOOTER.includes("isAuthed")).toBe(true);
    expect(/isAuthed[\s\S]*\?[\s\S]*\][\s\S]*:[\s\S]*\/login/.test(FOOTER)).toBe(true);
  });
  it("footer links target the 44px minimum touch target", () => {
    // FooterColumn <Link> uses min-h-[44px].
    expect(/data-testid="v2-footer-link"[\s\S]{0,200}min-h-\[44px\]/.test(FOOTER)).toBe(true);
  });
});

describe("Explore filter layout contract", () => {
  it("does not use the -mx-4 + px-4 pattern that overflowed the document at 390px", () => {
    // The failing pattern extended the filter wrapper 16px past the container.
    expect(EXPLORE_FILTERS.includes("-mx-4")).toBe(false);
  });
  it("bounds the filter wrapper to its container width", () => {
    expect(EXPLORE_FILTERS.includes("w-full max-w-full overflow-x-hidden")).toBe(true);
  });
  it("keeps filters in normal flow so catalog cards are never covered", () => {
    expect(EXPLORE_FILTERS.includes('data-testid="explore-filters"')).toBe(true);
    expect(EXPLORE_FILTERS.includes('className="sticky')).toBe(false);
    expect(EXPLORE_FILTERS.includes("top-[8rem]")).toBe(false);
  });
  it("gives both filter dialogs an accessible title and description", () => {
    expect(EXPLORE_FILTERS.includes("<DrawerTitle")).toBe(true);
    expect(EXPLORE_FILTERS.includes("<DrawerDescription")).toBe(true);
    expect(EXPLORE_FILTERS.includes("<SheetTitle")).toBe(true);
    expect(EXPLORE_FILTERS.includes("<SheetDescription")).toBe(true);
  });
});
