import { describe, it, expect } from "bun:test";

declare const require: (m: string) => any;
const { readFileSync } = require("fs");
const { resolve } = require("path");

const HERE: string = (import.meta as unknown as { dir?: string }).dir ?? ".";
const SRC = resolve(HERE, "../../../");

function read(rel: string): string {
  return readFileSync(resolve(SRC, rel), "utf8");
}

describe("Client-side security-log write path is neutralized (pre-launch)", () => {
  it("App.tsx no longer wraps the tree in SecurityMonitoringWrapper", () => {
    const app = read("App.tsx");
    expect(app.includes("import { SecurityMonitoringWrapper }")).toBe(false);
    expect(/<SecurityMonitoringWrapper[\s>]/.test(app)).toBe(false);
    expect(/<\/SecurityMonitoringWrapper>/.test(app)).toBe(false);
  });

  it("utils/logging/security.ts does not call supabase.from('security_logs')", () => {
    const src = read("utils/logging/security.ts");
    expect(/supabase\.from\(['"]security_logs['"]\)/.test(src)).toBe(false);
    // Direct supabase client import should be gone too.
    expect(/from ['"]@\/integrations\/supabase\/client['"]/.test(src)).toBe(false);
  });

  it("utils/security/securityLogger.ts does not INSERT into security_logs", () => {
    const src = read("utils/security/securityLogger.ts");
    expect(/supabase\.from\(['"]security_logs['"]\)/.test(src)).toBe(false);
    expect(/\.insert\(/.test(src)).toBe(false);
  });

  it("utils/security/enhancedSecurityLogger.ts does not INSERT into security_logs", () => {
    const src = read("utils/security/enhancedSecurityLogger.ts");
    // The static method may still exist, but must not perform DB writes.
    const insertBlock = src.match(
      /supabase[\s\S]*?\.from\(['"]security_logs['"]\)[\s\S]*?\.insert\(/,
    );
    expect(insertBlock).toBeNull();
  });
});
