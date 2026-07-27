/**
 * Contract test for the is_verified_admin fix migration and the security_logs
 * admin SELECT policy replacement.
 */
import { describe, it, expect } from "bun:test";

declare const require: (m: string) => any;

const MIGRATION =
  "supabase/migrations/20260727080240_870ae012-6371-4d81-8b8f-77b2ff5bea7f.sql";

function read(rel: string): string {
  const fs = require("fs") as { readFileSync(p: string, enc: string): string };
  return fs.readFileSync(rel, "utf8");
}

describe("is_verified_admin migration contract", () => {
  const sql = read(MIGRATION);

  it("redefines is_verified_admin using is_admin()", () => {
    expect(/CREATE OR REPLACE FUNCTION\s+public\.is_verified_admin/i.test(sql)).toBe(true);
    expect(/SELECT\s+public\.is_admin\(\)/i.test(sql)).toBe(true);
    expect(/STABLE/i.test(sql)).toBe(true);
    expect(/SECURITY DEFINER/i.test(sql)).toBe(true);
    expect(/SET\s+search_path\s*=\s*''/i.test(sql)).toBe(true);
  });

  it("does not reintroduce the stale profiles.role lookup", () => {
    expect(/FROM\s+public\.profiles/i.test(sql)).toBe(false);
    expect(/SELECT\s+role\s+INTO/i.test(sql)).toBe(false);
  });

  it("has no per-check admin_audit_log insert side effect", () => {
    expect(/INSERT\s+INTO\s+public\.admin_audit_log/i.test(sql)).toBe(false);
  });

  it("replaces the security_logs admin SELECT policy to use is_admin()", () => {
    expect(
      /DROP POLICY[^\n]*"Verified admins can view all security logs"[^\n]*ON\s+public\.security_logs/i.test(
        sql,
      ),
    ).toBe(true);
    expect(
      /CREATE POLICY[\s\S]*ON\s+public\.security_logs[\s\S]*FOR\s+SELECT[\s\S]*USING\s*\(\s*public\.is_admin\(\)\s*\)/i.test(
        sql,
      ),
    ).toBe(true);
  });

  it("does not touch security_logs data or insert policies", () => {
    expect(/DELETE\s+FROM\s+public\.security_logs/i.test(sql)).toBe(false);
    expect(/UPDATE\s+public\.security_logs/i.test(sql)).toBe(false);
    expect(/INSERT\s+INTO\s+public\.security_logs/i.test(sql)).toBe(false);
    expect(/DROP POLICY[^\n]*insert[^\n]*security_logs/i.test(sql)).toBe(false);
  });
});
