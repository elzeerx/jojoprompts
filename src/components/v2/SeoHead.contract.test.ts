/**
 * SEO metadata contract for V2 routes.
 *
 * These tests are source/DOM-level (no full render):
 * 1. index.html no longer ships competing static meta tags that Helmet
 *    would duplicate at hydration time (description, robots, og:*,
 *    twitter:*, canonical). Only the pre-hydration <title> stays.
 * 2. SeoHead's `shouldNoindex` gate:
 *      - preview hosts, dev hosts, SSR, unknown hosts, and launch-locked
 *        production ALL return true.
 *      - only jojoprompts.com with launchLocked=false and no opt-out
 *        returns false.
 * 3. Every private/authenticated route's SeoHead caller passes `noindex`.
 * 4. SeoHead uses PRODUCTION_ORIGIN and DEFAULT_OG_IMAGE points at
 *    https://jojoprompts.com/og/... — never a lovable.app/R2 preview URL.
 * 5. HomePage + HowItWorksPage route through SeoHead (no hand-rolled
 *    Helmet meta that would compete).
 */
import { describe, it, expect } from "bun:test";
import {
  DEFAULT_OG_IMAGE,
  PRODUCTION_HOST,
  PRODUCTION_ORIGIN,
  shouldNoindex,
} from "@/components/v2/SeoHead";

declare const require: (m: string) => any;
const { readFileSync } = require("fs");
const { resolve } = require("path");

const HERE: string = (import.meta as unknown as { dir?: string }).dir ?? ".";
const REPO_ROOT = resolve(HERE, "../../..");

function read(rel: string) {
  return readFileSync(resolve(REPO_ROOT, rel), "utf8") as string;
}

describe("index.html static head no longer competes with SeoHead/Helmet", () => {
  const html = read("index.html");

  it("does not ship a static <meta name=\"description\">", () => {
    expect(/<meta\s+name=["']description["']/i.test(html)).toBe(false);
  });

  it("does not ship a static <meta name=\"robots\">", () => {
    expect(/<meta\s+name=["']robots["']/i.test(html)).toBe(false);
  });

  it("does not ship static og:* tags", () => {
    expect(/property=["']og:title["']/i.test(html)).toBe(false);
    expect(/property=["']og:description["']/i.test(html)).toBe(false);
    expect(/property=["']og:url["']/i.test(html)).toBe(false);
    expect(/property=["']og:image["']/i.test(html)).toBe(false);
  });

  it("does not ship static twitter:* tags", () => {
    expect(/name=["']twitter:(title|description|url|image|card)["']/i.test(html)).toBe(false);
  });

  it("does not ship a static <link rel=\"canonical\">", () => {
    expect(/<link\s+rel=["']canonical["']/i.test(html)).toBe(false);
  });

  it("keeps only safe bootstrap tags (charset, viewport, icon, fallback title)", () => {
    expect(/<meta\s+charset=/i.test(html)).toBe(true);
    expect(/<meta\s+name=["']viewport["']/i.test(html)).toBe(true);
    expect(/<link\s+rel=["']icon["']/i.test(html)).toBe(true);
    expect(/<title>[^<]+<\/title>/i.test(html)).toBe(true);
  });
});

describe("SeoHead.shouldNoindex — preview/maintenance vs production unlock gate", () => {
  const previewHosts = [
    "id-preview--766f3370-d38c-42e5-8566-5e4946986dd2.lovable.app",
    "id-preview--abc123.lovable.app",
    "jojoprompts.lovable.app",
    "evil.id-preview--x.lovable.app",
    "id-preview--x.lovable.app.evil.com",
    "example.com",
    "",
  ];

  it("noindex when opt-out is set, regardless of host/launch", () => {
    expect(
      shouldNoindex({ optOut: true, hostname: PRODUCTION_HOST, launchLocked: false }),
    ).toBe(true);
  });

  it("noindex on every preview/dev/unknown host even with launchLocked=false", () => {
    for (const host of previewHosts) {
      expect({ host, noindex: shouldNoindex({ hostname: host, launchLocked: false }) })
        .toEqual({ host, noindex: true });
    }
  });

  it("noindex under SSR / missing hostname", () => {
    expect(shouldNoindex({ hostname: null, launchLocked: false })).toBe(true);
    expect(shouldNoindex({ hostname: undefined, launchLocked: false })).toBe(true);
  });

  it("noindex on production while launchLocked=true", () => {
    expect(shouldNoindex({ hostname: PRODUCTION_HOST, launchLocked: true })).toBe(true);
  });

  it("index,follow ONLY when hostname === jojoprompts.com AND launchLocked=false AND no opt-out", () => {
    expect(shouldNoindex({ hostname: PRODUCTION_HOST, launchLocked: false })).toBe(false);
    // Case-insensitive host match.
    expect(shouldNoindex({ hostname: "JojoPrompts.com", launchLocked: false })).toBe(false);
  });
});

describe("Private / authenticated routes always pass noindex to SeoHead", () => {
  const PRIVATE_ROUTES = [
    "src/pages/v2/LibraryPage.tsx",
    "src/pages/v2/AccountPage.tsx",
    "src/pages/v2/CartPage.tsx",
    "src/pages/v2/V2OrdersPage.tsx",
    "src/pages/v2/V2CheckoutPage.tsx",
    "src/pages/v2/V2CheckoutReturnPage.tsx",
    "src/pages/v2/V2CheckoutCancelPage.tsx",
  ];

  for (const file of PRIVATE_ROUTES) {
    it(`${file} — every SeoHead usage includes noindex`, () => {
      const src = read(file);
      const seoBlocks = src.match(/<SeoHead[\s\S]*?\/>/g) ?? [];
      expect({ file, hasSeoHead: seoBlocks.length > 0 }).toEqual({
        file,
        hasSeoHead: true,
      });
      for (const block of seoBlocks) {
        expect({ file, block, hasNoindex: /\bnoindex\b/.test(block) }).toEqual({
          file,
          block,
          hasNoindex: true,
        });
      }
    });
  }
});

describe("SeoHead production origin and stable share image", () => {
  it("PRODUCTION_ORIGIN is the jojoprompts.com apex", () => {
    expect(PRODUCTION_ORIGIN).toBe("https://jojoprompts.com");
  });

  it("DEFAULT_OG_IMAGE lives under the production /og/ path", () => {
    expect(DEFAULT_OG_IMAGE.startsWith("https://jojoprompts.com/og/")).toBe(true);
  });

  it("DEFAULT_OG_IMAGE is never a lovable.app or R2 preview URL", () => {
    expect(/lovable\.app/i.test(DEFAULT_OG_IMAGE)).toBe(false);
    expect(/r2\.dev|r2\.cloudflarestorage\.com/i.test(DEFAULT_OG_IMAGE)).toBe(false);
    expect(/id-preview--/i.test(DEFAULT_OG_IMAGE)).toBe(false);
  });

  it("SeoHead source references no lovable.app or preview host literals", () => {
    const src = read("src/components/v2/SeoHead.tsx");
    expect(/lovable\.app/i.test(src)).toBe(false);
    expect(/id-preview--/i.test(src)).toBe(false);
    expect(/r2\.dev|r2\.cloudflarestorage\.com/i.test(src)).toBe(false);
  });
});

describe("HomePage and HowItWorksPage route SEO through SeoHead", () => {
  const HOME = read("src/pages/HomePage.tsx");
  const HIW = read("src/pages/v2/HowItWorksPage.tsx");

  it("HomePage imports SeoHead and does NOT use react-helmet-async directly", () => {
    expect(/from ["']@\/components\/v2\/SeoHead["']/.test(HOME)).toBe(true);
    expect(/from ["']react-helmet-async["']/.test(HOME)).toBe(false);
    expect(/<Helmet\b/.test(HOME)).toBe(false);
  });

  it("HowItWorksPage imports SeoHead and does NOT use react-helmet-async directly", () => {
    expect(/from ["']@\/components\/v2\/SeoHead["']/.test(HIW)).toBe(true);
    expect(/from ["']react-helmet-async["']/.test(HIW)).toBe(false);
    expect(/<Helmet\b/.test(HIW)).toBe(false);
  });
});
