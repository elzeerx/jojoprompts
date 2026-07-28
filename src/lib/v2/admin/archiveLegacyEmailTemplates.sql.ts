/**
 * Source-only fixture: archive the seven confirmed-unused legacy
 * email_templates rows.
 *
 * Applied live?  NO — this is a source fixture only. Do not run against
 * production Supabase without explicit approval. It is idempotent, contains
 * NO deletes, and includes an exact reversible rollback in `rollbackSql`.
 *
 * Scope is the exact seven slugs enumerated by the completed audit
 * (docs/security/LEGACY_AUDIT_2026-07-28.md). Any slug outside this set is
 * left untouched. Content, subject, html, text and history are preserved.
 */

export const LEGACY_ARCHIVE_SLUGS = [
  "email_confirmation",
  "marketing_general",
  "password_reset",
  "payment_confirmation",
  "plan_reminder",
  "plan_selection_nudge",
  "welcome",
] as const;

export type LegacyArchiveSlug = (typeof LEGACY_ARCHIVE_SLUGS)[number];

// Forward (archive) SQL — idempotent UPDATE only, scoped to exact slug list.
export const archiveLegacyEmailTemplatesSql = `-- 2026-07-28: source-only fixture (NOT APPLIED live)
-- Archive the seven confirmed-unused legacy email_templates rows by
-- setting is_active = false. No DELETE / DROP / TRUNCATE. Idempotent.
BEGIN;

UPDATE public.email_templates
SET is_active = false,
    updated_at = now()
WHERE slug IN (
  'email_confirmation',
  'marketing_general',
  'password_reset',
  'payment_confirmation',
  'plan_reminder',
  'plan_selection_nudge',
  'welcome'
)
AND is_active = true;

COMMIT;
`;

// Rollback SQL — restores is_active = true for the same exact slug set.
export const rollbackSql = `-- Rollback for archive_legacy_email_templates (source-only)
BEGIN;

UPDATE public.email_templates
SET is_active = true,
    updated_at = now()
WHERE slug IN (
  'email_confirmation',
  'marketing_general',
  'password_reset',
  'payment_confirmation',
  'plan_reminder',
  'plan_selection_nudge',
  'welcome'
);

COMMIT;
`;

export const metadata = {
  intendedMigrationName: "archive_legacy_email_templates",
  appliedLive: false,
  idempotent: true,
  containsDelete: false,
  reversible: true,
  scopeSlugs: LEGACY_ARCHIVE_SLUGS,
} as const;
