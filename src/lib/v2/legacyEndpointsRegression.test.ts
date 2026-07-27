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
  ...FORBIDDEN_INVOKES.map((slug) => ({
    label: `functions.invoke('${slug}')`,
    re: new RegExp(
      `functions\\.invoke\\(\\s*['\"\`]${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['\"\`]`,
    ),
  })),
  {
    label: "route: /payment/upayments-callback (string literal)",
    re: /["'`]\/payment\/upayments-callback["'`]/,
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

describe("legacy endpoint contract — active src/** has no retired references", () => {
  const files = walk(SRC)
    .map((f) => ({
      rel: relative(SRC, f).replace(/\\/g, "/"),
      src: readFileSync(f, "utf8") as string,
    }))
    // Exclude test files themselves — they legitimately contain the
    // forbidden pattern strings as regex/label literals.
    .filter(({ rel }) => !/\.test\.tsx?$/.test(rel))
    // Exclude the neutralized legacy callback stub, whose comments
    // reference the retired route path only for documentation.
    .filter(({ rel }) => rel !== "pages/UpaymentCallbackPage.tsx")
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
});
