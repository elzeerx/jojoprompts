import { describe, it, expect } from "bun:test";
import {
  EMAIL_RUNTIME_PATHS,
  FORBIDDEN_RUNTIME_PATH_TOKENS,
  getEmailRuntimePath,
} from "./emailRuntimePaths";

// Bun-native file access; avoids @types/node in the TS project.
const bun = (globalThis as unknown as {
  Bun: {
    file: (p: string) => { text: () => Promise<string>; exists: () => Promise<boolean> };
  };
}).Bun;

describe("emailRuntimePaths registry (source of truth)", () => {
  it("contains exactly the four canonical customer email surfaces", () => {
    const keys = EMAIL_RUNTIME_PATHS.map((p) => p.key);
    expect(keys).toEqual([
      "v2-order-receipt",
      "welcome",
      "auth-email-confirmation",
      "auth-password-reset",
    ]);
  });

  it("never references known retired / never-existed runtime tokens", () => {
    for (const entry of EMAIL_RUNTIME_PATHS) {
      const joined = [entry.purpose, entry.purposeAr, ...entry.runtimePaths].join(" | ");
      for (const token of FORBIDDEN_RUNTIME_PATH_TOKENS) {
        if (token === "send-order-receipt") {
          const negatingRx = /never from a `send-order-receipt`|no `send-order-receipt`/i;
          const includes = joined.includes(token);
          expect(includes ? negatingRx.test(joined) : true).toBe(true);
          continue;
        }
        const includes = joined.includes(token);
        expect(includes).toBe(false);
      }
    }
  });

  it("every source-file runtime path claimed as active actually exists", async () => {
    for (const entry of EMAIL_RUNTIME_PATHS) {
      if (entry.status !== "active") continue;
      for (const p of entry.runtimePaths) {
        if (!p.startsWith("supabase/functions/")) continue;
        const exists = await bun.file(p).exists();
        expect(exists).toBe(true);
      }
    }
  });

  it("welcome entry is `not_configured` and has no source paths", () => {
    const w = getEmailRuntimePath("welcome");
    expect(w?.status).toBe("not_configured");
    expect(w?.runtimePaths.length).toBe(0);
    expect(!!w?.notConfiguredReason).toBe(true);
  });

  it("order-receipt entry cites the shared receipt module and both v2 upayments callers", () => {
    const r = getEmailRuntimePath("v2-order-receipt");
    expect(r?.status).toBe("active");
    expect(r?.runtimePaths).toContain("supabase/functions/_shared/v2ReceiptDelivery.ts");
    expect(r?.runtimePaths).toContain("supabase/functions/v2-upayments-webhook/index.ts");
    expect(r?.runtimePaths).toContain("supabase/functions/v2-upayments-status/index.ts");
  });

  it("auth surfaces are `active` and only cite Supabase Auth built-ins", () => {
    for (const key of ["auth-email-confirmation", "auth-password-reset"]) {
      const e = getEmailRuntimePath(key)!;
      expect(e.status).toBe("active");
      expect(e.source).toBe("Supabase Auth");
      for (const p of e.runtimePaths) {
        expect(p.includes("Supabase Auth built-in")).toBe(true);
      }
    }
  });

  it("EmailTemplatesManagement.tsx consumes the registry, not a hard-coded literal", async () => {
    const file = await bun.file("src/components/admin/EmailTemplatesManagement.tsx").text();
    expect(file.includes("EMAIL_RUNTIME_PATHS")).toBe(true);
    // Retired names must not appear in the admin UI copy.
    expect(file.includes("send-order-receipt")).toBe(false);
    expect(file.includes("send-welcome Edge Function")).toBe(false);
  });
});
