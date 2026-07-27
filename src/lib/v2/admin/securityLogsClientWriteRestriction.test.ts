import { describe, it, expect } from "bun:test";
import {
  SECURITY_LOGS_CLIENT_WRITE_RESTRICTION as F,
  SECURITY_LOGS_CLIENT_WRITE_RESTRICTION_APPLIED,
  SECURITY_LOGS_CLIENT_WRITE_RESTRICTION_MIGRATION_FILENAME as FILENAME,
  SECURITY_LOGS_CLIENT_WRITE_RESTRICTION_SQL as SQL,
} from "./securityLogsClientWriteRestriction.sql";

describe("security_logs client-write restriction — source fixture", () => {
  it("uses the intended future migration filename", () => {
    expect(FILENAME).toBe(
      "20260727150000_restrict_security_logs_client_writes.sql",
    );
    expect(F.filename).toBe(FILENAME);
  });

  it("is marked as source-only (not applied to production)", () => {
    expect(SECURITY_LOGS_CLIENT_WRITE_RESTRICTION_APPLIED).toBe(false);
    expect(F.applied).toBe(false);
  });

  it("drops the two known legacy INSERT policies by exact name", () => {
    expect(
      SQL.includes(
        'DROP POLICY IF EXISTS "Anonymous users can insert anonymous security logs" ON public.security_logs;',
      ),
    ).toBe(true);
    expect(
      SQL.includes(
        'DROP POLICY IF EXISTS "Authenticated users can insert own security logs"   ON public.security_logs;',
      ),
    ).toBe(true);
  });

  it("revokes INSERT/UPDATE/DELETE from both browser roles", () => {
    expect(
      /REVOKE INSERT, UPDATE, DELETE ON public\.security_logs FROM anon;/.test(
        SQL,
      ),
    ).toBe(true);
    expect(
      /REVOKE INSERT, UPDATE, DELETE ON public\.security_logs FROM authenticated;/.test(
        SQL,
      ),
    ).toBe(true);
  });

  it("preserves service_role full access", () => {
    expect(/GRANT ALL ON public\.security_logs TO service_role;/.test(SQL)).toBe(
      true,
    );
  });

  it("does not create or broaden any SELECT / admin policy", () => {
    expect(/CREATE POLICY/i.test(SQL)).toBe(false);
    expect(/REVOKE SELECT/i.test(SQL)).toBe(false);
    expect(/GRANT SELECT ON public\.security_logs TO (anon|authenticated)/i.test(SQL)).toBe(false);
  });

  it("does not touch out-of-scope tables, users, or storage", () => {
    for (const forbidden of [
      "activity_events",
      "payment_events",
      "public.orders",
      "entitlements",
      "public.resources",
      "public.users",
      "auth.users",
      "storage.objects",
      "storage.buckets",
      "storage.bucket",
    ]) {
      expect(SQL.includes(forbidden)).toBe(false);
    }
  });

  it("does not disable RLS or drop the table", () => {
    expect(/DISABLE ROW LEVEL SECURITY/i.test(SQL)).toBe(false);
    expect(/DROP TABLE[^\n]*security_logs/i.test(SQL)).toBe(false);
  });

  it("only references public.security_logs (single-table scope)", () => {
    const refs = SQL.match(/public\.[a-z_]+/g) ?? [];
    for (const r of refs) {
      expect(r).toBe("public.security_logs");
    }
  });
});
