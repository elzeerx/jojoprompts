import { describe, it, expect } from "bun:test";
import {
  SYSTEM_LOG_RLS_HARDENING,
  SYSTEM_LOG_RLS_HARDENING_MIGRATION_FILENAME,
  SYSTEM_LOG_RLS_HARDENING_SQL,
} from "./systemLogRlsHardening.sql";

declare const require: (m: string) => any;

const SQL = SYSTEM_LOG_RLS_HARDENING_SQL;

const TIGHTENED_TABLES = [
  "access_evaluations",
  "api_request_logs",
  "apple_email_logs",
  "backup_recovery_logs",
  "behavioral_anomalies",
  "database_activity_log",
  "response_executions",
  "security_training_records",
  "signup_audit_log",
  "unsubscribed_emails",
];

describe("system-log RLS hardening migration fixture", () => {
  it("targets the intended migration filename", () => {
    expect(SYSTEM_LOG_RLS_HARDENING_MIGRATION_FILENAME).toBe(
      "20260728000000_system_log_rls_hardening.sql",
    );
    expect(SYSTEM_LOG_RLS_HARDENING.filename).toBe(
      SYSTEM_LOG_RLS_HARDENING_MIGRATION_FILENAME,
    );
  });

  it("drops the ten open WITH CHECK true INSERT policies", () => {
    for (const table of TIGHTENED_TABLES) {
      expect(SQL).toContain(`ON public.${table};`);
    }
    const openCheck =
      /public\.(access_evaluations|api_request_logs|apple_email_logs|backup_recovery_logs|behavioral_anomalies|database_activity_log|response_executions|security_training_records|signup_audit_log|unsubscribed_emails)[^;]*WITH CHECK\s+true/i;
    expect(openCheck.test(SQL)).toBe(false);
  });

  it("revokes anon+authenticated INSERT/UPDATE/DELETE on all ten tables", () => {
    for (const table of TIGHTENED_TABLES) {
      expect(SQL).toContain(
        `REVOKE INSERT, UPDATE, DELETE ON public.${table} FROM anon, authenticated;`,
      );
      expect(SQL).toContain(`GRANT ALL ON public.${table} TO service_role;`);
    }
  });

  it("removes the two anon-writable public endpoints", () => {
    expect(SQL).toContain(
      `REVOKE INSERT, UPDATE, DELETE ON public.signup_audit_log FROM anon, authenticated;`,
    );
    expect(SQL).toContain(
      `REVOKE INSERT, UPDATE, DELETE ON public.unsubscribed_emails FROM anon, authenticated;`,
    );
    expect(SQL).toContain(
      `DROP POLICY IF EXISTS "Anyone can insert unsubscribe records" ON public.unsubscribed_emails;`,
    );
  });

  it("preserves the narrow authenticated resubscribe surface via JWT-email match", () => {
    expect(SQL).toContain(`"Users can view own unsubscribe record"`);
    expect(SQL).toContain(`"Users can resubscribe own email"`);
    expect(SQL).toContain(`auth.jwt() ->> 'email'`);
    expect(SQL).toContain(
      `GRANT SELECT, UPDATE ON public.unsubscribed_emails TO authenticated;`,
    );
    expect(
      /GRANT[^;]*INSERT[^;]*ON public\.unsubscribed_emails TO authenticated/.test(SQL),
    ).toBe(false);

  });

  it("drops broad public listing and broad authenticated writes on storage.objects", () => {
    for (const p of [
      "Allow public access to view files",
      "Allow authenticated users to upload files",
      "Allow authenticated users to update files",
      "Allow authenticated users to delete files",
      "Allow authenticated uploads",
      "Upload default prompt images",
      "Update default prompt images",
      "Delete default prompt images",
      "Avatars are publicly viewable",
      "prompt_files_select_subscription_v2",
      "Authenticated users can view workflow files",
    ]) {
      expect(SQL).toContain(`DROP POLICY IF EXISTS "${p}" ON storage.objects;`);
    }
  });

  it("replaces storage.bucket + default-prompt-images writes with admin-scoped policies", () => {
    for (const p of [
      "site_bucket_admin_insert_v2",
      "site_bucket_admin_update_v2",
      "site_bucket_admin_delete_v2",
      "default_prompt_images_admin_insert_v2",
      "default_prompt_images_admin_update_v2",
      "default_prompt_images_admin_delete_v2",
    ]) {
      expect(SQL).toContain(`"${p}"`);
    }
    const created = SQL.match(/CREATE POLICY[\s\S]*?;/g) ?? [];
    const storageCreates = created.filter((s) =>
      /'storage\.bucket'|'default-prompt-images'/.test(s),
    );
    expect(storageCreates.length).toBe(6);
    for (const stmt of storageCreates) {
      expect(stmt).toContain("public.can_manage_prompts(auth.uid())");
      expect(stmt).toContain("TO authenticated");
    }
  });

  it("does not add any direct customer SELECT for resource-packages or prompt-files", () => {
    expect(/'resource-packages'/.test(SQL)).toBe(false);
    const created = SQL.match(/CREATE POLICY[\s\S]*?;/g) ?? [];
    for (const stmt of created) {
      if (/FOR SELECT/.test(stmt)) {
        expect(/'prompt-files'/.test(stmt)).toBe(false);
      }
    }
  });

  it("does not touch _v2_require_admin, entitlements, or paid-content tables", () => {
    for (const forbidden of [
      "_v2_require_admin",
      "public.entitlements",
      "public.resources",
      "public.resource_versions",
      "public.user_subscriptions",
      "public.user_roles",
      "public.orders",
      "public.payment_events",
    ]) {
      expect(SQL.includes(forbidden)).toBe(false);
    }
  });

  it("does not toggle bucket public/private flags or mutate objects", () => {
    expect(/UPDATE\s+storage\.buckets/i.test(SQL)).toBe(false);
    expect(/DELETE\s+FROM\s+storage\.objects/i.test(SQL)).toBe(false);
    expect(/storage\.buckets/i.test(SQL)).toBe(false);
  });
});

describe("_v2_require_admin admin-RPC invariant contract", () => {
  const MIGRATIONS_DIR = "supabase/migrations";
  const fs = require("fs") as {
    readdirSync(p: string): string[];
    readFileSync(p: string, enc: string): string;
  };
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));

  it("has a repo migration source that defines _v2_require_admin with the required guards", () => {
    const withHelper = files
      .map((f) => ({ f, sql: fs.readFileSync(`${MIGRATIONS_DIR}/${f}`, "utf8") }))
      .filter(({ sql }) => /CREATE OR REPLACE FUNCTION[^(]*_v2_require_admin/.test(sql));
    expect(withHelper.length).toBeGreaterThan(0);
    const latest = withHelper[withHelper.length - 1].sql;
    expect(latest).toMatch(/SECURITY DEFINER/i);
    expect(latest).toMatch(/SET search_path\s*=\s*''/i);
    // Null-check on auth.uid() (either directly or via a captured local).
    expect(/auth\.uid\(\)/.test(latest)).toBe(true);
    expect(/IS NULL/i.test(latest)).toBe(true);
    // Admin role check.
    expect(/has_role\([^)]*,\s*'admin'/i.test(latest)).toBe(true);
  });

  it("every latest v2_admin_*/get_admin_v2_* RPC source enforces admin authorization", () => {
    // Accepted enforcement shapes:
    //   (a) explicit call to public._v2_require_admin()
    //   (b) inline has_role(<uid>, 'admin') gate — has_role(NULL,...) returns
    //       false, so this rejects unauthenticated callers by construction.
    const latestBody = new Map<string, string>();
    const nameRx =
      /CREATE OR REPLACE FUNCTION\s+(?:public\.)?((?:v2_admin_|get_admin_v2_)[a-z0-9_]+)\s*\(/gi;
    for (const f of files) {
      const sql = fs.readFileSync(`${MIGRATIONS_DIR}/${f}`, "utf8");
      let m: RegExpExecArray | null;
      while ((m = nameRx.exec(sql)) !== null) {
        const fname = m[1];
        const start = m.index;
        const rest = sql.slice(start + 1);
        const nextIdx = rest.search(/\nCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/i);
        const end = nextIdx === -1 ? sql.length : start + 1 + nextIdx;
        latestBody.set(fname, sql.slice(start, end));
      }
    }
    const violations: string[] = [];
    for (const [fname, body] of latestBody) {
      const usesHelper = /_v2_require_admin\s*\(/.test(body);
      const usesInline = /has_role\([^;]*'admin'/i.test(body);
      if (!usesHelper && !usesInline) violations.push(fname);
    }
    expect(violations).toEqual([]);
  });
});



