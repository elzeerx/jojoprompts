/**
 * Contract tests for the canonical V2 public shell and V2 routing invariants.
 *
 * These are cheap static assertions against the source of `App.tsx`,
 * `V2Layout`, `RootLayout`, `routes`, `NotFoundPage`, and the additive
 * overview migration. They catch obvious regressions without needing to
 * mount React or hit a database.
 */
import { describe, it, expect } from "bun:test";

declare const require: (m: string) => any;
const { readFileSync, readdirSync, existsSync } = require("fs");
const { resolve, join } = require("path");

const HERE: string = (import.meta as unknown as { dir?: string }).dir ?? ".";
const SRC = resolve(HERE, "../..");
const REPO_ROOT = resolve(HERE, "../../..");

const read = (p: string): string => readFileSync(p, "utf8") as string;

const APP: string = read(resolve(SRC, "App.tsx"));
const V2LAYOUT: string = read(resolve(SRC, "components/v2/V2Layout.tsx"));
const ROOT_LAYOUT_PATH = resolve(SRC, "components/layout/root-layout.tsx");
const ROUTES_SRC: string = read(resolve(SRC, "config/routes.ts"));
const NOT_FOUND: string = read(resolve(SRC, "pages/NotFoundPage.tsx"));

describe("V2 public shell — customer chrome is exclusively V2Layout", () => {
  it("App.tsx no longer keeps a V2_PATHS allowlist or falls back to RootLayout", () => {
    expect(/V2_PATHS/.test(APP)).toBe(false);
    expect(/RootLayout/.test(APP)).toBe(false);
  });

  it("App.tsx mounts V2Layout as the only customer/public shell", () => {
    expect(APP.includes("<Route element={<V2Layout />}>")).toBe(true);
    // No nested legacy shell composition.
    expect(/<RootLayout\s*\/>/.test(APP)).toBe(false);
  });

  it("V2Layout renders exactly one V2Header + V2Footer and no legacy Header", () => {
    expect(V2LAYOUT.includes("<V2Header />")).toBe(true);
    expect(V2LAYOUT.includes("<V2Footer />")).toBe(true);
    expect(/<Header\s*\/>/.test(V2LAYOUT)).toBe(false);
    expect(/FloatingAddPromptButton/.test(V2LAYOUT)).toBe(false);
  });

  it("wildcard `*` catch-all is nested inside V2Layout when unlocked", () => {
    // Verify the V2Layout branch is defined and that the shared `routes`
    // config supplies the wildcard route through it.
    const v2Block =
      /<Route element=\{<V2Layout \/>\}>[\s\S]*?<\/Route>/m.exec(APP);
    expect(v2Block).not.toBeNull();
    expect(v2Block![0].includes("routes.map(")).toBe(true);
    expect(/path:\s*"\*"/.test(ROUTES_SRC)).toBe(true);
  });

  it("RootLayout source is not imported by any active router entry point", () => {
    // The file may remain on disk as archival, but App.tsx must not import it.
    expect(/from ["'].*root-layout["']/.test(APP)).toBe(false);
    // If the file exists, no other active src/** module should re-import it.
    if (existsSync(ROOT_LAYOUT_PATH)) {
      // walk src/ for RootLayout imports outside archival tests
      const bad: string[] = [];
      const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          if (entry.name === "node_modules" || entry.name === ".git") continue;
          const p = join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(p);
            continue;
          }
          if (!/\.(ts|tsx)$/.test(entry.name)) continue;
          if (/\.test\.tsx?$/.test(entry.name)) continue;
          if (p === resolve(SRC, "App.tsx")) continue;
          if (p === ROOT_LAYOUT_PATH) continue;
          const s = read(p);
          if (/from ["'][^"']*root-layout["']/.test(s)) bad.push(p);
        }
      };
      walk(SRC);
      expect(bad).toEqual([]);
    }
  });
});

describe("V2 route table — no premium/subscription/legacy customer surfaces", () => {
  it("routes.ts contains no `protection: \"premium\"` entries", () => {
    expect(/protection:\s*["']premium["']/.test(ROUTES_SRC)).toBe(false);
  });

  it("routes.ts does not import retired V1 page components", () => {
    const retired = [
      "PromptsPage",
      "ChatGPTPromptsPage",
      "MidjourneyPromptsPage",
      "WorkflowPromptsPage",
      "GPTsBuilderPage",
      "FavoritesPage",
      "SearchPage",
      "ExamplesPage",
      "EnhancedPromptDemo",
      "PaymentSuccessPage",
      "PaymentFailedPage",
      "PaymentDashboardPage",
      "PaymentRecoveryPage",
      "UserDashboardPage",
      "SubscriptionDashboard",
      "PrompterDashboard",
      "PlatformTest",
      "DemoHub",
    ];
    for (const name of retired) {
      expect({ name, importedInRoutes: new RegExp(`\\b${name}\\b`).test(ROUTES_SRC) }).toEqual({
        name,
        importedInRoutes: false,
      });
    }
  });

  it("App.tsx does not import AuthPremiumGuard or apply premium protection", () => {
    expect(/AuthPremiumGuard/.test(APP)).toBe(false);
    expect(/case ["']premium["']/.test(APP)).toBe(false);
  });

  it("no active src/** module imports AuthPremiumGuard", () => {
    const bad: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        const p = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(p);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry.name)) continue;
        if (/\.test\.tsx?$/.test(entry.name)) continue;
        const s = read(p);
        // The declaration file may still export the symbol for archival
        // reasons; we only fail on *imports* of it from other files.
        if (/import[\s\S]*?AuthPremiumGuard[\s\S]*?from/.test(s)) bad.push(p);
      }
    };
    walk(SRC);
    expect(bad).toEqual([]);
  });

  it("prompter/creator routes are not active V2 surfaces", () => {
    // Prompter routes may only exist inside the LEGACY_REDIRECTS map in
    // App.tsx (as redirect sources). They must not appear in the
    // canonical `routes` config.
    expect(/["']prompter["']/.test(ROUTES_SRC)).toBe(false);
    expect(/["']dashboard\/prompter["']/.test(ROUTES_SRC)).toBe(false);
  });
});

describe("Legacy V1 → V2 redirects resolve to fixed V2 destinations", () => {
  const EXPECTED: Record<string, string> = {
    prompts: "/prompts-catalog",
    "prompts/chatgpt": "/prompts-catalog?platform=chatgpt",
    "prompts/midjourney": "/image-styles",
    "prompts/workflow": "/automations",
    "prompts/gpts-builder": "/skills",
    favorites: "/library",
    "payment-dashboard": "/orders",
    dashboard: "/account",
    "dashboard/subscription": "/account",
    "payment-success": "/orders",
    "payment-failed": "/orders",
    "payment-recovery": "/orders",
    "dashboard/prompter": "/explore",
    prompter: "/explore",
    examples: "/explore",
    search: "/explore",
    "demo/enhanced-prompt": "/explore",
  };

  it("App.tsx declares each expected redirect with a fixed destination", () => {
    for (const [from, to] of Object.entries(EXPECTED)) {
      const line = new RegExp(
        `\\[\\s*["']${from.replace(/[/-]/g, "\\$&")}["']\\s*,\\s*["']${to.replace(/[/?=]/g, "\\$&")}["']\\s*\\]`,
      );
      expect({ from, to, present: line.test(APP) }).toEqual({
        from,
        to,
        present: true,
      });
    }
  });

  it("redirect destinations exist in the canonical routes table (no loops)", () => {
    const destinations = new Set(
      Object.values(EXPECTED).map((d) => d.replace(/\?.*$/, "").replace(/^\//, "")),
    );
    const paths = new Set<string>();
    const rx = /path:\s*["']([^"']+)["']/g;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(ROUTES_SRC))) paths.add(m[1] === "/" ? "" : m[1]);
    for (const dest of destinations) {
      // "" corresponds to root ("/"), which is present as "/" in routes.
      const ok = dest === "" ? paths.has("") || paths.has("/") : paths.has(dest);
      expect({ dest, ok }).toEqual({ dest, ok: true });
    }
  });

  it("redirect source paths do NOT also appear as active routes (no loops)", () => {
    const activePaths = new Set<string>();
    const rx = /path:\s*["']([^"']+)["']/g;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(ROUTES_SRC))) activePaths.add(m[1]);
    for (const from of Object.keys(EXPECTED)) {
      expect({ from, activeRouteCollision: activePaths.has(from) }).toEqual({
        from,
        activeRouteCollision: false,
      });
    }
  });
});

describe("V2 NotFoundPage is bilingual, RTL-aware, marketplace-branded", () => {
  it("uses the LanguageContext and toggles direction", () => {
    expect(/useLanguage\s*\(/.test(NOT_FOUND)).toBe(true);
    expect(/isRTL/.test(NOT_FOUND)).toBe(true);
    expect(/dir=\{isRTL\s*\?\s*["']rtl["']\s*:\s*["']ltr["']\}/.test(NOT_FOUND)).toBe(true);
  });

  it("links to Explore, Home, and Contact", () => {
    expect(/to=["']\/explore["']/.test(NOT_FOUND)).toBe(true);
    expect(/to=["']\/["']/.test(NOT_FOUND)).toBe(true);
    expect(/to=["']\/contact["']/.test(NOT_FOUND)).toBe(true);
  });

  it("has 44px targets and reduced-motion safety", () => {
    expect(/min-h-\[44px\]/.test(NOT_FOUND)).toBe(true);
    expect(/motion-reduce:animate-none/.test(NOT_FOUND)).toBe(true);
  });

  it("does not render legacy prompt-only copy or FloatingAddPromptButton", () => {
    expect(/FloatingAddPromptButton/.test(NOT_FOUND)).toBe(false);
    expect(/Browse Prompts/i.test(NOT_FOUND)).toBe(false);
  });

  it("includes both English and Arabic strings", () => {
    // Latin marketplace copy + Arabic characters both required.
    expect(/marketplace/i.test(NOT_FOUND)).toBe(true);
    expect(/[\u0600-\u06FF]/.test(NOT_FOUND)).toBe(true);
  });
});

describe("Additive admin overview migration — capture-ever semantics", () => {
  const MIG = resolve(
    REPO_ROOT,
    "supabase/migrations/20260727100000_admin_overview_payment_semantics.sql",
  );

  it("migration file exists and replaces get_admin_v2_overview", () => {
    expect(existsSync(MIG)).toBe(true);
    const sql = read(MIG);
    expect(
      /CREATE OR REPLACE FUNCTION public\.get_admin_v2_overview/.test(sql),
    ).toBe(true);
    expect(/SECURITY DEFINER/.test(sql)).toBe(true);
    expect(/SET search_path = ''/.test(sql)).toBe(true);
  });

  it("uses captured-ever / failed-without-capture per-order aggregation", () => {
    const sql = read(MIG);
    expect(/bool_or\(event_type::text = 'captured'\)/.test(sql)).toBe(true);
    expect(/bool_or\(event_type::text = 'failed'\)/.test(sql)).toBe(true);
    expect(/failed_ever AND NOT captured_ever/.test(sql)).toBe(true);
    // The success branch must count captured orders regardless of any
    // accompanying failed event.
    expect(/count\(\*\) FILTER \(WHERE captured_ever\)/.test(sql)).toBe(true);
    // No DISTINCT ON "latest event" logic — that was the incorrect model.
    expect(/DISTINCT ON \(order_id\)/.test(sql)).toBe(false);
  });

  it("preserves the payment_success_rate null-when-empty contract", () => {
    const sql = read(MIG);
    expect(
      /IF \(v_success_count \+ v_failure_count\) > 0 THEN[\s\S]*v_success_rate := round/.test(
        sql,
      ),
    ).toBe(true);
  });
});
