import { describe, it, expect } from "bun:test";
import {
  SECURITY_LOGS_HARDENING,
  SECURITY_LOGS_HARDENING_MIGRATION_FILENAME,
  SECURITY_LOGS_HARDENING_SQL as SQL,
} from "./securityLogsHardening.sql";

describe("security_logs write-hardening fixture", () => {
  it("uses the intended future migration filename", () => {
    expect(SECURITY_LOGS_HARDENING_MIGRATION_FILENAME).toBe(
      "20260728010000_security_logs_write_hardening.sql",
    );
    expect(SECURITY_LOGS_HARDENING.filename).toBe(
      SECURITY_LOGS_HARDENING_MIGRATION_FILENAME,
    );
  });

  it("revokes browser-role INSERT and preserves service_role writes", () => {
    expect(/REVOKE INSERT ON public\.security_logs FROM anon;/.test(SQL)).toBe(true);
    expect(/REVOKE INSERT ON public\.security_logs FROM authenticated;/.test(SQL)).toBe(true);
    expect(
      /GRANT INSERT,\s*SELECT ON public\.security_logs TO service_role;/.test(SQL),
    ).toBe(true);
  });

  it("drops legacy insert policies idempotently and does not create new ones", () => {
    expect(/DROP POLICY IF EXISTS[^\n]*ON public\.security_logs;/.test(SQL)).toBe(true);
    // No CREATE POLICY on security_logs in this fixture (read scope
    // is intentionally not broadened).
    expect(/CREATE POLICY[^\n]*ON public\.security_logs/i.test(SQL)).toBe(false);
  });

  it("does not touch out-of-scope tables/objects", () => {
    for (const forbidden of [
      "activity_events",
      "payment_events",
      "public.orders",
      "entitlements",
      "public.resources",
      "public.users",
      "storage.objects",
      "storage.buckets",
    ]) {
      expect(SQL.includes(forbidden)).toBe(false);
    }
  });

  it("does not disable RLS or drop the table", () => {
    expect(/DISABLE ROW LEVEL SECURITY/i.test(SQL)).toBe(false);
    expect(/DROP TABLE[^\n]*security_logs/i.test(SQL)).toBe(false);
  });
});
