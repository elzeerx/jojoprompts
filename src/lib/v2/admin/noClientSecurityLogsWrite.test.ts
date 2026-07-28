/**
 * Regression guard: the browser bundle must never INSERT into
 * public.security_logs. RLS revokes authenticated writes and every
 * such call becomes a repeated 401 in production. Any client-side
 * telemetry must go through the unified logger; server-side capture
 * is handled by Edge Functions / service_role.
 */
import { describe, it, expect } from "bun:test";

declare const require: (m: string) => any;
const { readdirSync, statSync, readFileSync } = require("fs");
const { join, resolve, relative } = require("path");

const HERE: string = (import.meta as unknown as { dir?: string }).dir ?? ".";
const SRC = resolve(HERE, "../../../");

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      // Skip generated Supabase types and dependency graveyards.
      if (entry === "node_modules" || entry === "dist" || entry === "build") continue;
      yield* walk(full);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      yield full;
    }
  }
}

const OFFENDING = [
  // Direct table INSERT patterns.
  /\.from\(\s*['"]security_logs['"]\s*\)\s*[\s\S]{0,120}?\.insert\s*\(/,
  // POST to the PostgREST REST endpoint.
  /rest\/v1\/security_logs/,
  // RPC helpers that we know are elevated writers.
  /rpc\(\s*['"]secure_security_log_insert['"]/,
];

const SKIP_FILE = (rel: string) =>
  rel.endsWith(".test.ts") ||
  rel.endsWith(".test.tsx") ||
  rel.endsWith("integrations/supabase/types.ts") ||
  // Neutralised legacy shims — kept for compilation only.
  rel.endsWith("utils/logging/security.ts") ||
  rel.endsWith("utils/security/securityLogger.ts") ||
  rel.endsWith("utils/security/enhancedSecurityLogger.ts");

describe("Frontend must not INSERT into public.security_logs", () => {
  it("no active .ts/.tsx file performs a client-side security_logs write", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = relative(SRC, file);
      if (SKIP_FILE(rel)) continue;
      const src = readFileSync(file, "utf8") as string;
      for (const rx of OFFENDING) {
        if (rx.test(src)) {
          offenders.push(`${rel} :: matches ${rx}`);
          break;
        }
      }
    }
    if (offenders.length > 0) {
      // Assertion message surfaces the exact files to fix.
      throw new Error(
        `Client-side security_logs writes are forbidden. Offenders:\n  - ${offenders.join("\n  - ")}`,
      );
    }
    expect(offenders).toEqual([]);
  });
});
