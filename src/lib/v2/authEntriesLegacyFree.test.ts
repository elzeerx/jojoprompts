/**
 * Contract regressions guarding the V2 auth cleanup:
 *  - Active auth entries must not re-introduce legacy plan-gated redirects or
 *    CheckoutContextManager coupling.
 *  - AccountPage must call every Hook before its <Navigate /> early return.
 */
import { describe, it, expect } from "bun:test";

declare const require: (m: string) => any;
const { readFileSync } = require("fs");
const { resolve } = require("path");

const HERE: string = (import.meta as unknown as { dir?: string }).dir ?? ".";
const read = (rel: string) => readFileSync(resolve(HERE, rel), "utf8") as string;

const files: Record<string, string> = {
  LoginForm: read("../../components/auth/LoginForm.tsx"),
  useGoogleAuth: read("../../components/auth/hooks/useGoogleAuth.ts"),
  useSignupForm: read("../../components/auth/hooks/useSignupForm.ts"),
  MagicLoginPage: read("../../pages/MagicLoginPage.tsx"),
  MagicLinkSentPage: read("../../pages/MagicLinkSentPage.tsx"),
  EmailConfirmationPage: read("../../pages/EmailConfirmationPage.tsx"),
  useAuthInitialization: read("../../contexts/auth/useAuthInitialization.ts"),
};

describe("V2 auth entries — legacy plan gating removed", () => {
  it("does not import CheckoutContextManager", () => {
    for (const [name, src] of Object.entries(files)) {
      const importsCcm =
        /import\s+\{[^}]*CheckoutContextManager[^}]*\}\s+from/.test(src);
      expect({ name, importsCcm }).toEqual({ name, importsCcm: false });
    }
  });

  it("does not redirect to /pricing?from_signup=true", () => {
    for (const [name, src] of Object.entries(files)) {
      expect({ name, hit: /from_signup=true/.test(src) }).toEqual({
        name,
        hit: false,
      });
    }
  });

  it("does not build /checkout?plan_id=<x> URLs", () => {
    for (const [name, src] of Object.entries(files)) {
      expect({ name, hit: /plan_id=\$\{/.test(src) }).toEqual({
        name,
        hit: false,
      });
    }
  });
});

describe("AccountPage — Hooks precede early return", () => {
  it("useMemo(displayName) is declared before the <Navigate /> return", () => {
    const src = read("../../pages/v2/AccountPage.tsx");
    const memoIdx = src.indexOf("const displayName = useMemo");
    const navigateIdx = src.indexOf("<Navigate to={`/login?next=");
    expect(memoIdx).toBeGreaterThan(-1);
    expect(navigateIdx).toBeGreaterThan(-1);
    expect(memoIdx).toBeLessThan(navigateIdx);
  });
});
