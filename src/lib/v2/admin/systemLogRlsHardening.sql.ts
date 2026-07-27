/**
 * Supabase migration SOURCE for pre-launch RLS/storage hardening of
 * system/log tables and public storage buckets.
 *
 * STATUS: APPLIED LIVE as migration
 *   20260727135637 system_log_rls_hardening
 * This in-repo fixture is retained as the version-controlled record of
 * the applied definition (no local executable migration file is created
 * to avoid duplication). The SQL below is congruent with the applied
 * definition — do not diverge without a follow-up live migration.
 *
 * SCOPE (defensive, non-destructive):
 *   • Removes 10 open `WITH CHECK true` INSERT policies on system/log
 *     tables. None of those tables are written by any active client
 *     caller in this repo (see docs/security/system-log-callers.md).
 *   • Revokes anon INSERT on `signup_audit_log` and `unsubscribed_emails`
 *     — both former public endpoints are now retired (410) or
 *     token-only+service-role.
 *   • Revokes authenticated INSERT/UPDATE/DELETE on the 10 tables,
 *     except for a narrowly-scoped owner UPDATE/SELECT on
 *     `unsubscribed_emails` used by the authenticated
 *     `EmailPreferences` resubscribe UI (JWT-email match only).
 *   • service_role retains full access; existing admin/user SELECT
 *     policies are preserved.
 *   • storage.objects: removes broad public listing and broad
 *     authenticated writes on `storage.bucket` and `default-prompt-images`
 *     write policies; removes the legacy subscription-based
 *     `prompt-files` SELECT policy; removes the redundant
 *     `Avatars are publicly viewable` SELECT policy (direct object
 *     delivery survives because the bucket public flag is preserved).
 *   • Does NOT change bucket public/private flags, does NOT touch
 *     objects, does NOT add any direct SELECT policy for
 *     `resource-packages` (downloads remain server-authorized via
 *     `resource-download` signed URLs), and does NOT modify
 *     `_v2_require_admin`, entitlement helpers, or paid-content tables.
 *
 * ROLLBACK NOTE (avatars public listing):
 *   Direct GET of an avatar object continues to work while the
 *   `avatars` bucket public flag is `true` — Supabase Storage serves
 *   objects from public buckets even without an explicit SELECT
 *   policy on `storage.objects`. The removed policy only affected
 *   `LIST`/enumeration. If a future feature needs anonymous
 *   enumeration of avatar objects, restore with:
 *     CREATE POLICY "Avatars are publicly viewable" ON storage.objects
 *       FOR SELECT USING (bucket_id = 'avatars');
 *   The same pattern applies to `storage.bucket`'s removed
 *   `Allow public access to view files` policy.
 */

export const SYSTEM_LOG_RLS_HARDENING_MIGRATION_FILENAME =
  "20260727135637_system_log_rls_hardening.sql";

/** Applied live — recorded for parity with the production catalog. */
export const SYSTEM_LOG_RLS_HARDENING_APPLIED_LIVE = {
  version: "20260727135637",
  name: "system_log_rls_hardening",
  applied: true,
} as const;

const OPEN_INSERT_TABLES: Array<{ table: string; policy: string }> = [
  { table: "access_evaluations", policy: "System can insert access evaluations" },
  { table: "api_request_logs", policy: "System can insert API logs" },
  { table: "apple_email_logs", policy: "System can insert Apple email logs" },
  { table: "backup_recovery_logs", policy: "System can insert backup recovery logs" },
  { table: "behavioral_anomalies", policy: "System can insert anomalies" },
  { table: "database_activity_log", policy: "System can insert database activity" },
  { table: "response_executions", policy: "System can insert executions" },
  { table: "security_training_records", policy: "System can insert training records" },
  { table: "signup_audit_log", policy: "System can insert signup audit logs" },
  { table: "unsubscribed_emails", policy: "Anyone can insert unsubscribe records" },
];

const TIGHTEN_TABLES: readonly string[] = OPEN_INSERT_TABLES.map((t) => t.table);

const dropOpenInserts = OPEN_INSERT_TABLES.map(
  ({ table, policy }) =>
    `DROP POLICY IF EXISTS "${policy}" ON public.${table};`,
).join("\n");

const tightenGrants = TIGHTEN_TABLES.map(
  (t) => `REVOKE INSERT, UPDATE, DELETE ON public.${t} FROM anon, authenticated;
GRANT ALL ON public.${t} TO service_role;`,
).join("\n");

const storageDrops = [
  `DROP POLICY IF EXISTS "Allow public access to view files" ON storage.objects;`,
  `DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;`,
  `DROP POLICY IF EXISTS "Allow authenticated users to update files" ON storage.objects;`,
  `DROP POLICY IF EXISTS "Allow authenticated users to delete files" ON storage.objects;`,
  `DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;`,
  `DROP POLICY IF EXISTS "Upload default prompt images" ON storage.objects;`,
  `DROP POLICY IF EXISTS "Update default prompt images" ON storage.objects;`,
  `DROP POLICY IF EXISTS "Delete default prompt images" ON storage.objects;`,
  `DROP POLICY IF EXISTS "Avatars are publicly viewable" ON storage.objects;`,
  `DROP POLICY IF EXISTS "prompt_files_select_subscription_v2" ON storage.objects;`,
  `DROP POLICY IF EXISTS "Authenticated users can view workflow files" ON storage.objects;`,
].join("\n");

const storageAdminReplacements = `
-- storage.bucket: admin-scoped writes only
CREATE POLICY "site_bucket_admin_insert_v2" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'storage.bucket' AND public.can_manage_prompts(auth.uid()));
CREATE POLICY "site_bucket_admin_update_v2" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'storage.bucket' AND public.can_manage_prompts(auth.uid()))
  WITH CHECK (bucket_id = 'storage.bucket' AND public.can_manage_prompts(auth.uid()));
CREATE POLICY "site_bucket_admin_delete_v2" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'storage.bucket' AND public.can_manage_prompts(auth.uid()));

-- default-prompt-images: admin-scoped writes only (reads unchanged)
CREATE POLICY "default_prompt_images_admin_insert_v2" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'default-prompt-images' AND public.can_manage_prompts(auth.uid()));
CREATE POLICY "default_prompt_images_admin_update_v2" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'default-prompt-images' AND public.can_manage_prompts(auth.uid()))
  WITH CHECK (bucket_id = 'default-prompt-images' AND public.can_manage_prompts(auth.uid()));
CREATE POLICY "default_prompt_images_admin_delete_v2" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'default-prompt-images' AND public.can_manage_prompts(auth.uid()));
`.trim();

const unsubscribedOwnerPolicies = `
-- Narrow owner-scoped policies for the authenticated resubscribe UI in
-- src/components/account/EmailPreferences.tsx. JWT-email match only;
-- no INSERT (that path is service_role via smart-unsubscribe).
DROP POLICY IF EXISTS "Users can view own unsubscribe record" ON public.unsubscribed_emails;
CREATE POLICY "Users can view own unsubscribe record" ON public.unsubscribed_emails
  FOR SELECT TO authenticated
  USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

DROP POLICY IF EXISTS "Users can resubscribe own email" ON public.unsubscribed_emails;
CREATE POLICY "Users can resubscribe own email" ON public.unsubscribed_emails
  FOR UPDATE TO authenticated
  USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  WITH CHECK (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Preserve the resubscribe UPDATE surface at the grant layer.
GRANT SELECT, UPDATE ON public.unsubscribed_emails TO authenticated;
`.trim();

export const SYSTEM_LOG_RLS_HARDENING_SQL = `-- V2 pre-launch hardening: system/log RLS + storage.objects tightening.
-- Additive, idempotent, non-destructive. See fixture header for full scope.

BEGIN;

-- 1) Drop open INSERT policies (WITH CHECK true) on system/log tables.
${dropOpenInserts}

-- 2) Revoke anon/authenticated write privileges. service_role retains ALL.
${tightenGrants}

-- 3) Narrow owner-scoped surface for the active resubscribe UI.
${unsubscribedOwnerPolicies}

-- 4) storage.objects tightening — drop broad public/authenticated policies.
${storageDrops}

-- 5) storage.objects — admin-scoped replacements for site + default-prompt-images.
${storageAdminReplacements}

COMMIT;
`;

export const SYSTEM_LOG_RLS_HARDENING = {
  filename: SYSTEM_LOG_RLS_HARDENING_MIGRATION_FILENAME,
  sql: SYSTEM_LOG_RLS_HARDENING_SQL,
  tables: TIGHTEN_TABLES,
  droppedOpenInsertPolicies: OPEN_INSERT_TABLES,
} as const;
