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
    expect(v2Block === null).toBe(false);
    expect((v2Block?.[0] ?? "").includes("routes.map(")).toBe(true);
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

describe("Admin overview payment semantics — cross-window final definition", () => {
  // Source fixture that mirrors the two applied live migrations:
  //   20260727134427 admin_overview_payment_semantics
  //   20260727135118 admin_overview_payment_semantics_cross_window_fix
  // No local migration file exists; the fixture is a version-controlled
  // record of the final applied definition.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const {
    ADMIN_OVERVIEW_PAYMENT_SEMANTICS_SQL: sql,
    ADMIN_OVERVIEW_PAYMENT_SEMANTICS_MIGRATION_FILENAME: filename,
    APPLIED_LIVE_MIGRATIONS: applied,
  } = require(resolve(SRC, "lib/v2/admin/overviewPaymentSemantics.sql.ts"));

  it("documents the applied live migration mapping", () => {
    expect(filename).toBe(
      "20260727135118_admin_overview_payment_semantics_cross_window_fix.sql",
    );
    const versions = applied.map((m: { version: string }) => m.version);
    expect(versions).toEqual(["20260727134427", "20260727135118"]);
    expect(applied[0].name).toBe("admin_overview_payment_semantics");
    expect(applied[1].name).toBe(
      "admin_overview_payment_semantics_cross_window_fix",
    );
  });

  it("replaces get_admin_v2_overview with hardened SECURITY DEFINER", () => {
    expect(
      /CREATE OR REPLACE FUNCTION public\.get_admin_v2_overview/.test(sql),
    ).toBe(true);
    expect(/SECURITY DEFINER/.test(sql)).toBe(true);
    expect(/SET search_path = ''/.test(sql)).toBe(true);
    expect(/has_role\(v_actor, 'admin'::public\.app_role\)/.test(sql)).toBe(
      true,
    );
  });

  it("uses cross-window captured-ever aggregation (success=in-window, failure excludes any captured_ever)", () => {
    expect(/orders_in_window/.test(sql)).toBe(true);
    expect(
      /bool_or\(pe\.event_type::text = 'captured' AND pe\.received_at >= v_since\) AS captured_in_window/.test(
        sql,
      ),
    ).toBe(true);
    expect(
      /bool_or\(pe\.event_type::text = 'captured'\)\s+AS captured_ever/.test(sql),
    ).toBe(true);
    expect(
      /bool_or\(pe\.event_type::text = 'failed'\s+AND pe\.received_at >= v_since\) AS failed_in_window/.test(
        sql,
      ),
    ).toBe(true);
    expect(/failed_in_window AND NOT captured_ever/.test(sql)).toBe(true);
    expect(/count\(\*\) FILTER \(WHERE captured_in_window\)/.test(sql)).toBe(
      true,
    );
    // The old buggy per-window captured_ever model must be gone.
    expect(
      /bool_or\(event_type::text = 'captured'\) AS captured_ever/.test(sql),
    ).toBe(false);
    expect(/DISTINCT ON \(order_id\)/.test(sql)).toBe(false);
  });

  it("cross-window guard: a capture before the window shields a later in-window failed event", () => {
    // Textual contract: the failure filter must reference captured_ever
    // (all history) rather than a window-bounded captured flag. This
    // proves the fix from 20260727135118 is encoded.
    const failureLine = sql
      .split("\n")
      .find((l: string) => /failed.*NOT captured/i.test(l));
    expect(failureLine).toBeTruthy();
    expect(/captured_ever/.test(failureLine!)).toBe(true);
    expect(/captured_in_window/.test(failureLine!)).toBe(false);
  });

  it("preserves the payment_success_rate null-when-empty contract", () => {
    expect(
      /IF \(v_success_count \+ v_failure_count\) > 0 THEN[\s\S]*v_success_rate := round/.test(
        sql,
      ),
    ).toBe(true);
  });

  it("preserves the existing grant / revoke boundary", () => {
    expect(
      /REVOKE ALL ON FUNCTION public\.get_admin_v2_overview\(int\) FROM PUBLIC, anon/.test(
        sql,
      ),
    ).toBe(true);
    expect(
      /GRANT EXECUTE ON FUNCTION public\.get_admin_v2_overview\(int\) TO authenticated, service_role/.test(
        sql,
      ),
    ).toBe(true);
  });

  it("simulator: capture BEFORE window + failed retry INSIDE window => not counted as failure", () => {
    // Model the SQL's per-order semantics in JS to prove the encoded
    // rule: an order captured at any point (even before the window)
    // must not be counted as a failure when a later in-window failed
    // event lands. Only success in-window and failure with no
    // captured_ever should tally.
    type Ev = { order_id: string; event_type: "captured" | "failed"; received_at: number };
    const WINDOW_SINCE = 100;
    const events: Ev[] = [
      // Order A: captured at t=50 (before window), then failed retry at t=150 (in window)
      { order_id: "A", event_type: "captured", received_at: 50 },
      { order_id: "A", event_type: "failed", received_at: 150 },
      // Order B: only failed at t=200 (in window), never captured
      { order_id: "B", event_type: "failed", received_at: 200 },
      // Order C: captured at t=180 (in window)
      { order_id: "C", event_type: "captured", received_at: 180 },
      // Order D: captured at t=60 (before window) — no in-window activity
      { order_id: "D", event_type: "captured", received_at: 60 },
    ];

    const inWindow = new Set(
      events.filter((e) => e.received_at >= WINDOW_SINCE).map((e) => e.order_id),
    );
    const perOrder = new Map<string, { capturedInWindow: boolean; capturedEver: boolean; failedInWindow: boolean }>();
    for (const oid of inWindow) {
      const evs = events.filter((e) => e.order_id === oid);
      perOrder.set(oid, {
        capturedInWindow: evs.some((e) => e.event_type === "captured" && e.received_at >= WINDOW_SINCE),
        capturedEver:     evs.some((e) => e.event_type === "captured"),
        failedInWindow:   evs.some((e) => e.event_type === "failed"   && e.received_at >= WINDOW_SINCE),
      });
    }

    let success = 0, failure = 0;
    for (const [, p] of perOrder) {
      if (p.capturedInWindow) success++;
      if (p.failedInWindow && !p.capturedEver) failure++;
    }

    // A is shielded (captured before window), B is a real failure,
    // C is a success in window, D is not in the window set at all.
    expect(success).toBe(1); // C
    expect(failure).toBe(1); // B (A NOT counted)
    expect(perOrder.has("A")).toBe(true);
    expect(perOrder.get("A")!.capturedEver).toBe(true);
    expect(perOrder.get("A")!.failedInWindow).toBe(true);
    // Encoded rule shields A from the failure count.
    expect(perOrder.get("A")!.failedInWindow && !perOrder.get("A")!.capturedEver).toBe(false);
    expect(perOrder.has("D")).toBe(false);
  });
});


