/**
 * V2 release-hardening contract regression.
 *
 * Fails the build if any active `src/**` file references a retired legacy
 * Edge Function slug, a legacy PayPal client path, the legacy UPayments
 * callback route, plan/subscription acquisition URLs, or wires
 * `CheckoutContextManager` into an active V2 auth entry.
 *
 * The single legitimate reference site is this file itself and its sibling
 * `legacyEndpoints.ts` slug list.
 */
import { describe, it, expect } from "bun:test";

declare const require: (m: string) => any;
const { readdirSync, statSync, readFileSync } = require("fs");
const { resolve, join, relative } = require("path");

const HERE: string = (import.meta as unknown as { dir?: string }).dir ?? ".";
const SRC = resolve(HERE, "../..");

const IGNORE_FILES = new Set<string>([
  relative(SRC, resolve(HERE, "legacyEndpoints.ts")),
  relative(SRC, resolve(HERE, "legacyEndpointsRegression.test.ts")),
  // Audit documentation registry — records slug names as data, does not invoke.
  relative(SRC, resolve(HERE, "admin/edgeFunctionRetirementInventory.ts")),
  relative(SRC, resolve(HERE, "admin/edgeFunctionRetirementInventory.test.ts")),
  // The retired stub pages themselves reference the legacy route only in
  // comments; they don't invoke the endpoint. Grep patterns below match only
  // invocation shapes and the raw slug in code strings, so the stubs are OK.
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir) as string[]) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(name)) out.push(full);
  }
  return out;
}

const FORBIDDEN_INVOKES = [
  "process-upayments-payment",
  "upayments-webhook",
  "get-transaction-by-order",
  "recover-orphaned-payments",
  "scheduled-payment-cleanup",
  "send-purchase-confirmation",
  "create-paypal-payment",
  "capture-paypal-payment",
  "verify-paypal-payment",
  "process-paypal-payment",
  "auto-capture-paypal",
];

const FORBIDDEN_PATTERNS: Array<{ label: string; re: RegExp }> = [
  // Direct `functions.invoke("<slug>")` invocation.
  ...FORBIDDEN_INVOKES.map((slug) => ({
    label: `functions.invoke('${slug}')`,
    re: new RegExp(
      `functions\\.invoke\\(\\s*['\"\`]${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['\"\`]`,
    ),
  })),
  // Any occurrence of the retired slug as a bare string literal (single or
  // double-quoted only — backticks are intentionally excluded so JSDoc and
  // prose blocks that name the retired slug for documentation don't trip
  // the check). Catches dynamic invocation via
  // `const SLUG = "…"; functions.invoke(SLUG)`.
  ...FORBIDDEN_INVOKES.map((slug) => ({
    label: `slug literal "${slug}"`,
    re: new RegExp(
      `['\"]${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['\"]`,
    ),
  })),
  // Retired route paths, with OR without a leading slash. Matches
  // `path: "payment/upayments-callback"` and `"/payment/upayments-callback"`.
  // Retired route paths, with OR without a leading slash. Matches
  // `path: "payment/upayments-callback"` and `"/payment/upayments-callback"`.
  // Single/double quotes only — prose backticks in comments are OK.
  {
    label: "route path: payment/upayments-callback",
    re: /["']\/?payment\/upayments-callback["']/,
  },
  {
    label: "route path: payment/callback",
    re: /["']\/?payment\/callback["']/,
  },
];

// Plan/subscription acquisition redirects and templated
// `/checkout?plan_id=…` URLs still exist in legacy pricing/payment shells
// that are outside the V2 surface. They are enforced against V2 auth
// entries only, via the dedicated block below.
const V2_AUTH_ONLY_FORBIDDEN: Array<{ label: string; re: RegExp }> = [
  { label: "from_signup=true redirect", re: /from_signup=true/ },
  { label: "/checkout?plan_id=${…} template", re: /\/checkout\?plan_id=\$\{/ },
];

const V2_AUTH_ENTRIES = [
  "components/auth/LoginForm.tsx",
  "components/auth/hooks/useGoogleAuth.ts",
  "components/auth/hooks/useSignupForm.ts",
  "pages/MagicLoginPage.tsx",
  "pages/MagicLinkSentPage.tsx",
  "pages/EmailConfirmationPage.tsx",
  "contexts/auth/useAuthInitialization.ts",
];

// Legacy client pages whose ONLY legitimate residence is un-routed archival
// source. If routes.ts (the active route config) imports or routes any of
// these, the pass has regressed.
const RETIRED_PAGES = [
  "PaymentCallbackPage",
  "UpaymentCallbackPage",
];

describe("legacy endpoint contract — active src/** has no retired references", () => {
  const files = walk(SRC)
    .map((f) => ({
      rel: relative(SRC, f).replace(/\\/g, "/"),
      src: readFileSync(f, "utf8") as string,
    }))
    // Exclude test files themselves — they legitimately contain the
    // forbidden pattern strings as regex/label literals.
    .filter(({ rel }) => !/\.test\.tsx?$/.test(rel))
    // The retired page sources may reference their own name and legacy
    // route path in comments; they are un-routed archival.
    .filter(({ rel }) => rel !== "pages/UpaymentCallbackPage.tsx")
    .filter(({ rel }) => rel !== "pages/PaymentCallbackPage.tsx")
    .filter(({ rel }) => !IGNORE_FILES.has(rel));

  for (const { label, re } of FORBIDDEN_PATTERNS) {
    it(`no active file references: ${label}`, () => {
      const hits = files
        .filter(({ src }) => re.test(src))
        .map(({ rel }) => rel);
      expect({ label, hits }).toEqual({ label, hits: [] });
    });
  }

  for (const { label, re } of V2_AUTH_ONLY_FORBIDDEN) {
    it(`V2 auth entries do not use: ${label}`, () => {
      for (const rel of V2_AUTH_ENTRIES) {
        const src = readFileSync(resolve(SRC, rel), "utf8") as string;
        expect({ rel, label, bad: re.test(src) }).toEqual({
          rel,
          label,
          bad: false,
        });
      }
    });
  }

  it("V2 auth entries do not import CheckoutContextManager", () => {
    for (const rel of V2_AUTH_ENTRIES) {
      const src = readFileSync(resolve(SRC, rel), "utf8") as string;
      const bad =
        /import\s+\{[^}]*CheckoutContextManager[^}]*\}\s+from/.test(src);
      expect({ rel, bad }).toEqual({ rel, bad: false });
    }
  });

  it("V2 auth entries never default to /prompts or /pricing", () => {
    for (const rel of V2_AUTH_ENTRIES) {
      const src = readFileSync(resolve(SRC, rel), "utf8") as string;
      // Naive: no bare navigate('/prompts') / navigate('/pricing') calls.
      const bad = /navigate\(\s*['\"`]\/(prompts|pricing)['\"`]/.test(src);
      expect({ rel, bad }).toEqual({ rel, bad: false });
    }
  });

  it("active route config does not import or route retired legacy callback pages", () => {
    const routesSrc = readFileSync(
      resolve(SRC, "config/routes.ts"),
      "utf8",
    ) as string;
    for (const page of RETIRED_PAGES) {
      // Neither a `lazy(() => import(...PageName...))` nor a bare
      // named import of the retired page should exist.
      const importRe = new RegExp(
        `import\\(\\s*["'\`][^"'\`]*${page}["'\`]\\s*\\)`,
      );
      const namedRe = new RegExp(`\\b${page}\\b`);
      expect({ page, importer: importRe.test(routesSrc) }).toEqual({
        page,
        importer: false,
      });
      expect({ page, referenced: namedRe.test(routesSrc) }).toEqual({
        page,
        referenced: false,
      });
    }
  });
});
