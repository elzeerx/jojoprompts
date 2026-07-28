/**
 * Applied-live source record: archive the seven confirmed-unused legacy
 * email_templates rows.
 *
 * Applied live?  YES — migration `archive_legacy_email_templates` was
 * applied on 2026-07-28. Exactly the seven slugs enumerated by the
 * audit (docs/security/LEGACY_AUDIT_2026-07-28.md) are inactive; every
 * row's content, subject, html, text, and history is preserved. The
 * forward SQL below matches the applied migration verbatim: idempotent
 * UPDATE only, no DELETE / DROP / TRUNCATE. `rollbackSql` restores the
 * exact seven slugs to `is_active = true`.
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
export const archiveLegacyEmailTemplatesSql = `-- 2026-07-28: applied live as archive_legacy_email_templates.
-- Archives the seven confirmed-unused legacy email_templates rows by
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
export const rollbackSql = `-- Rollback for archive_legacy_email_templates.
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
  appliedLive: true,
  appliedOn: "2026-07-28",
  idempotent: true,
  containsDelete: false,
  reversible: true,
  scopeSlugs: LEGACY_ARCHIVE_SLUGS,
} as const;
