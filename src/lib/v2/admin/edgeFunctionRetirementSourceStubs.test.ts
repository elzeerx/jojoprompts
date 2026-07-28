/**
 * Source/live stub contract for retired Edge Functions.
 *
 * This test reads each `supabase/functions/<slug>/index.ts` on disk and
 * asserts the stub contract described in the retirement inventory:
 *
 *   - OPTIONS -> 204 with CORS headers.
 *   - Every other method -> 410 JSON containing exactly
 *     `error: "endpoint_retired"` and `function: "<slug>"`.
 *   - Response includes JSON content-type and `Cache-Control: no-store`.
 *   - No forbidden behavior in the source: no imports, no env reads, no
 *     body parsing, no external I/O, no database calls, no secrets, no
 *     logging.
 *   - Only the six documented `STUB_REPLACEMENTS` slugs carry the
 *     optional `replacement` field.
 *
 * The first 24 source stubs were fetched from the live Supabase project and
 * verified on 2026-07-29. `magic-login` is source-only until the controlled
 * deployment pass. This test keeps the in-repo contract deterministic; the
 * release checklist owns the live re-verification gate.
 */
import { describe, it, expect } from "bun:test";
declare const require: (m: string) => any;
const { readFileSync, existsSync } = require("fs");
import {
  RETIRED_STUB_SLUGS,
  RETIREMENT_BLOCKERS,
  RETIREMENT_SLUGS,
  STUB_REPLACEMENTS,
} from "./edgeFunctionRetirementInventory";

const FORBIDDEN_PATTERNS: readonly { name: string; re: RegExp }[] = [
  { name: "import statement", re: /^\s*import\s/m },
  { name: "dynamic import", re: /\bimport\s*\(/ },
  { name: "require()", re: /\brequire\s*\(/ },
  { name: "Deno.env access", re: /Deno\.env/ },
  { name: "body parsing (req.json)", re: /\.json\s*\(\s*\)/ },
  { name: "body parsing (req.text)", re: /\.text\s*\(\s*\)/ },
  { name: "body parsing (formData)", re: /\.formData\s*\(/ },
  { name: "outbound fetch", re: /\bfetch\s*\(/ },
  { name: "console logging", re: /console\.(log|info|warn|error|debug)/ },
  { name: "createClient (supabase)", re: /createClient\s*\(/ },
  { name: "createEdgeLogger", re: /createEdgeLogger/ },
  { name: "process env", re: /process\.env/ },
];

/** Active V2 functions that MUST remain untouched by this pass. */
const V2_UNTOUCHED_SAMPLES: readonly string[] = [
  "v2-upayments-checkout",
  "v2-upayments-status",
  "v2-upayments-webhook",
  "v2-upayments-refund",
  "v2-admin-upload-resource-file",
  "v2-admin-package-scan-control",
  "v2-package-scan-worker",
  "v2-admin-payment-settings-status",
];

const stubPath = (slug: string) => `supabase/functions/${slug}/index.ts`;

describe("Edge Function retirement source stubs", () => {
  it("stubs 24 verified-live slugs plus the source-only magic-login retirement", () => {
    expect(RETIRED_STUB_SLUGS.length).toBe(25);
  });

  it("stubbed set + blockers = full 25-slug retirement recommendation", () => {
    const union = new Set([...RETIRED_STUB_SLUGS, ...RETIREMENT_BLOCKERS]);
    expect(union).toEqual(new Set(RETIREMENT_SLUGS));
    expect(RETIRED_STUB_SLUGS.length + RETIREMENT_BLOCKERS.length).toBe(25);
  });

  it("no blockers remain — route-graph proof cleared all seven", () => {
    expect(RETIREMENT_BLOCKERS.length).toBe(0);
  });

  it("stubbed and blocker sets are disjoint", () => {
    const stubs = new Set<string>(RETIRED_STUB_SLUGS);
    for (const b of RETIREMENT_BLOCKERS) {
      expect(stubs.has(b)).toBe(false);
    }
  });


  it("every stub file exists on disk", () => {
    for (const slug of RETIRED_STUB_SLUGS) {
      expect(existsSync(stubPath(slug))).toBe(true);
    }
  });

  it("every stub source encodes the exact 410 JSON body and status", () => {
    for (const slug of RETIRED_STUB_SLUGS) {
      const src = readFileSync(stubPath(slug), "utf8");
      expect(src).toContain('"error":"endpoint_retired"');
      expect(src).toContain(`"function":"${slug}"`);
      expect(src).toContain("status: 410");
      expect(src).toContain("status: 204");
      expect(src).toContain("Cache-Control");
      expect(src).toContain("no-store");
      expect(src).toContain("application/json");
      expect(src).toContain("Access-Control-Allow-Origin");
      expect(src).toContain('req.method === "OPTIONS"');
      expect(src).toContain("Deno.serve");
    }
  });

  it("every stub source contains no forbidden behavior", () => {
    for (const slug of RETIRED_STUB_SLUGS) {
      const src = readFileSync(stubPath(slug), "utf8");
      for (const { name, re } of FORBIDDEN_PATTERNS) {
        expect({ slug, forbidden: name, matched: re.test(src) })
          .toEqual({ slug, forbidden: name, matched: false });
      }
    }
  });

  it("stubs are small (< 40 lines) — no residual legacy code", () => {
    for (const slug of RETIRED_STUB_SLUGS) {
      const src = readFileSync(stubPath(slug), "utf8");
      expect(src.split("\n").length).toBeLessThan(40);
    }
  });

  it("only the six documented replacements carry a `replacement` field", () => {
    const replacementKeys = new Set(Object.keys(STUB_REPLACEMENTS));
    expect(replacementKeys).toEqual(new Set([
      "process-upayments-payment",
      "upayments-webhook",
      "validate-file-upload",
      "auto-generate-prompt",
      "resend-confirmation-alternative",
      "magic-login",
    ]));

    for (const slug of RETIRED_STUB_SLUGS) {
      const src = readFileSync(stubPath(slug), "utf8");
      const expectedReplacement = STUB_REPLACEMENTS[slug];
      const hasReplacement = src.includes('"replacement":');
      if (expectedReplacement) {
        expect(hasReplacement).toBe(true);
        expect(src).toContain(`"replacement":"${expectedReplacement}"`);
      } else {
        expect(hasReplacement).toBe(false);
      }
    }
  });

  it("previously-blocking caller modules have been neutralized (no live invokes)", () => {
    const NEUTRALIZED_CALLERS: readonly { file: string; slug: string }[] = [
      { file: "src/hooks/payment/helpers/subscriptionActivator.ts", slug: "create-subscription" },
      { file: "src/pages/admin/components/users/hooks/useUserService.ts", slug: "cancel-subscription" },
      { file: "src/hooks/useSecureFileUpload.ts", slug: "validate-file-upload" },
      { file: "src/pages/admin/components/purchases/hooks/usePurchaseHistory.ts", slug: "get-admin-transactions" },
      { file: "src/hooks/useUsersWithoutPlans.ts", slug: "get-users-without-plans" },
      { file: "src/hooks/useMarketingEmails.ts", slug: "send-plan-reminder" },
      { file: "src/hooks/useMarketingEmails.ts", slug: "send-bulk-plan-reminders" },
    ];
    for (const { file, slug } of NEUTRALIZED_CALLERS) {
      expect(existsSync(file)).toBe(true);
      const src = readFileSync(file, "utf8");
      const invokeRe = new RegExp(
        `functions\\.invoke\\(\\s*['"\`]${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['"\`]`,
      );
      expect({ file, slug, invoked: invokeRe.test(src) })
        .toEqual({ file, slug, invoked: false });
    }
  });

  it("no active src/** file invokes any of the 25 retired slugs", () => {
    const { readdirSync, statSync } = require("fs");
    const { join, relative } = require("path");
    const SRC = "src";
    const walk = (dir: string, out: string[] = []): string[] => {
      for (const name of readdirSync(dir) as string[]) {
        if (name === "node_modules" || name.startsWith(".")) continue;
        const full = join(dir, name);
        const st = statSync(full);
        if (st.isDirectory()) walk(full, out);
        else if (/\.(ts|tsx|js|jsx)$/.test(name)) out.push(full);
      }
      return out;
    };
    const files = walk(SRC)
      .map((f: string) => ({
        rel: relative(".", f).replace(/\\/g, "/"),
        src: readFileSync(f, "utf8") as string,
      }))
      // Exclude tests + the inventory registry (documents slugs as data).
      .filter(({ rel }: { rel: string }) => !/\.test\.tsx?$/.test(rel))
      .filter(({ rel }: { rel: string }) =>
        rel !== "src/lib/v2/admin/edgeFunctionRetirementInventory.ts"
      );
    for (const slug of RETIRED_STUB_SLUGS) {
      const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`functions\\.invoke\\(\\s*['"\`]${escaped}['"\`]`);
      const hits = files
        .filter(({ src }: { src: string }) => re.test(src))
        .map(({ rel }: { rel: string }) => rel);
      expect({ slug, hits }).toEqual({ slug, hits: [] });
    }
  });

  it("active V2 functions are untouched by this retirement pass", () => {
    for (const slug of V2_UNTOUCHED_SAMPLES) {
      const path = stubPath(slug);
      if (!existsSync(path)) continue;
      const src = readFileSync(path, "utf8");
      const looksLikeRetirementStub =
        src.includes('"error":"endpoint_retired"') &&
        src.includes(`"function":"${slug}"`);
      expect({ slug, looksLikeRetirementStub })
        .toEqual({ slug, looksLikeRetirementStub: false });
    }
  });
});
