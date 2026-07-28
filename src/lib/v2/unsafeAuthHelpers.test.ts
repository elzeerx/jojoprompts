/**
 * V2 release-hardening contract: retired unsafe auth helpers and
 * admin-only Edge Function guards.
 *
 * Fails the build if:
 *   1) any active src/** file invokes `resend-confirmation-email`,
 *      `send-signup-confirmation`, or `check-email-exists`;
 *   2) hardened admin Edge Function sources omit their required
 *      auth/authorization guards (`getUser` + `can_manage_prompts`)
 *      before external API / storage work;
 *   3) `get-image` no longer enforces the published-resource +
 *      image-only authorization.
 *
 * Edge Function sources are read as static text — no network / no
 * runtime dependency.
 */
import { describe, it, expect } from "bun:test";

declare const require: (m: string) => any;
const { readdirSync, statSync, readFileSync, existsSync } = require("fs");
const { resolve, join, relative } = require("path");

const HERE: string = (import.meta as unknown as { dir?: string }).dir ?? ".";
const SRC = resolve(HERE, "../..");
const REPO_ROOT = resolve(SRC, "..");
const FUNCTIONS_ROOT = resolve(REPO_ROOT, "supabase/functions");

const RETIRED_AUTH_SLUGS = [
  "resend-confirmation-email",
  "send-signup-confirmation",
  "check-email-exists",
  "send-password-reset",
  "verify-password-reset",
  "validate-signup",
  "paypal-webhook",
  "track-email-engagement",
  "send-email-confirmation-reminder",
] as const;


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

describe("retired auth helpers — active src/** has no callers", () => {
  const files = walk(SRC)
    .map((f) => ({
      rel: relative(SRC, f).replace(/\\/g, "/"),
      src: readFileSync(f, "utf8") as string,
    }))
    .filter(({ rel }) => !/\.test\.tsx?$/.test(rel))
    // The retired-slug list literals themselves live in this file.
    .filter(({ rel }) => rel !== "lib/v2/unsafeAuthHelpers.test.ts")
    // Audit registry — records slug names as documentation, does not invoke.
    .filter(({ rel }) => rel !== "lib/v2/admin/edgeFunctionRetirementInventory.ts");

  for (const slug of RETIRED_AUTH_SLUGS) {
    it(`no active file invokes '${slug}'`, () => {
      const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const invokeRe = new RegExp(
        `functions\\.invoke\\(\\s*['\"\`]${escaped}['\"\`]`,
      );
      const literalRe = new RegExp(`['\"]${escaped}['\"]`);
      const hits = files
        .filter(({ src }) => invokeRe.test(src) || literalRe.test(src))
        .map(({ rel }) => rel);
      expect({ slug, hits }).toEqual({ slug, hits: [] });
    });
  }
});

describe("admin Edge Function guards (source-only, no network)", () => {
  // Note: `validate-file-upload` and `auto-generate-prompt` were replaced
  // with source-only HTTP 410 retirement stubs; their auth-guard assertions
  // are enforced by edgeFunctionRetirementSourceStubs.test.ts instead.
  const adminFns = [
    "translate-text",
    "suggest-prompt",
  ];


  for (const name of adminFns) {
    it(`${name} calls getUser and can_manage_prompts`, () => {
      const p = join(FUNCTIONS_ROOT, name, "index.ts");
      expect({ name, exists: existsSync(p) }).toEqual({ name, exists: true });
      const src = readFileSync(p, "utf8") as string;
      expect({ name, hasGetUser: /auth\.getUser\s*\(/.test(src) }).toEqual({
        name,
        hasGetUser: true,
      });
      expect({
        name,
        hasCanManage: /can_manage_prompts/.test(src),
      }).toEqual({ name, hasCanManage: true });
      // POST-only or explicit method guard.
      expect({
        name,
        methodGuard:
          /req\.method\s*!==\s*['"]POST['"]/.test(src) ||
          /Method Not Allowed|Method not allowed/.test(src),
      }).toEqual({ name, methodGuard: true });
    });
  }
});

describe("get-image enforces published-resource + image-only authorization", () => {
  const p = join(FUNCTIONS_ROOT, "get-image", "index.ts");
  const src = readFileSync(p, "utf8") as string;

  it("looks up hero_image_path on published, non-archived resources", () => {
    expect(/hero_image_path/.test(src)).toBe(true);
    expect(/['"]published['"]/.test(src)).toBe(true);
    expect(/archived_at/.test(src)).toBe(true);
  });

  it("gates response body by an image MIME allowlist", () => {
    expect(/IMAGE_MIME_ALLOWLIST/.test(src)).toBe(true);
    expect(/image\/jpeg/.test(src)).toBe(true);
  });

  it("rejects traversal, backslash, control, and double-encoded paths", () => {
    expect(/isSafeStoragePath/.test(src)).toBe(true);
    expect(/%\[0-9a-fA-F\]/.test(src)).toBe(true); // double-encoding guard
    expect(/\\\\\\\\x00/.test(src) || /\\x00-\\x1f/.test(src)).toBe(true);
  });

  it("is GET/OPTIONS only", () => {
    expect(/req\.method\s*!==\s*['"]GET['"]/.test(src)).toBe(true);
  });
});

describe("retired auth Edge Function stubs are archival 410s", () => {
  for (const slug of RETIRED_AUTH_SLUGS) {
    it(`${slug} source returns HTTP 410 and has no service_role / admin-API use`, () => {
      const p = join(FUNCTIONS_ROOT, slug, "index.ts");
      expect({ slug, exists: existsSync(p) }).toEqual({ slug, exists: true });
      const src = readFileSync(p, "utf8") as string;
      expect({ slug, has410: /status:\s*410/.test(src) }).toEqual({
        slug,
        has410: true,
      });
      expect({
        slug,
        hasServiceRole: /SUPABASE_SERVICE_ROLE_KEY/.test(src),
      }).toEqual({ slug, hasServiceRole: false });
      expect({
        slug,
        hasAdminApi: /auth\.admin\./.test(src),
      }).toEqual({ slug, hasAdminApi: false });
      expect({
        slug,
        callsSendEmail: /functions\.invoke\(['"]send-email['"]/.test(src),
      }).toEqual({ slug, callsSendEmail: false });
    });
  }
});

describe("password reset uses only official Supabase Auth methods", () => {
  const forgot = readFileSync(
    resolve(SRC, "components/auth/ForgotPasswordForm.tsx"),
    "utf8",
  ) as string;
  const reset = readFileSync(
    resolve(SRC, "components/auth/ResetPasswordForm.tsx"),
    "utf8",
  ) as string;
  const page = readFileSync(
    resolve(SRC, "pages/ResetPasswordPage.tsx"),
    "utf8",
  ) as string;

  it("ForgotPasswordForm calls supabase.auth.resetPasswordForEmail and no retired slug", () => {
    expect(/supabase\.auth\.resetPasswordForEmail\s*\(/.test(forgot)).toBe(true);
    expect(/functions\.invoke\(\s*['"]send-password-reset['"]/.test(forgot)).toBe(false);
    expect(/redirectTo:\s*`.*\/reset-password/.test(forgot)).toBe(true);
  });

  it("ResetPasswordForm calls supabase.auth.updateUser and no retired slug", () => {
    expect(/supabase\.auth\.updateUser\s*\(/.test(reset)).toBe(true);
    expect(/functions\.invoke\(\s*['"]verify-password-reset['"]/.test(reset)).toBe(false);
    // Recovery-session detection, no raw custom token consumption.
    expect(
      /PASSWORD_RECOVERY/.test(reset) || /onAuthStateChange/.test(reset),
    ).toBe(true);
  });

  it("ResetPasswordPage does not gate on raw query token", () => {
    expect(/searchParams\.get\(\s*['"]token['"]/.test(page)).toBe(false);
    expect(/searchParams\.get\(\s*['"]access_token['"]/.test(page)).toBe(false);
  });
});

describe("smart-unsubscribe is token-only", () => {
  const p = join(FUNCTIONS_ROOT, "smart-unsubscribe", "index.ts");
  const src = readFileSync(p, "utf8") as string;

  it("does not call auth.admin.listUsers", () => {
    expect(/listUsers\s*\(/.test(src)).toBe(false);
    expect(/auth\.admin\./.test(src)).toBe(false);
  });

  it("does not accept a raw email query parameter or body", () => {
    expect(/searchParams\.get\(\s*['"]email['"]/.test(src)).toBe(false);
    // No JSON body parsing branch that would carry a raw email.
    expect(/UnsubscribeRequest/.test(src)).toBe(false);
  });

  it("enforces a strict token contract and GET-only method", () => {
    expect(/TOKEN_RE|\[A-Za-z0-9\]\{32/.test(src)).toBe(true);
    expect(/req\.method\s*!==\s*['"]GET['"]/.test(src)).toBe(true);
  });

  it("does not mint / return a new unsubscribe link to any caller", () => {
    expect(/unsubscribeLink:\s*/.test(src)).toBe(false);
    expect(/generateUnsubscribeToken/.test(src)).toBe(false);
  });
});

