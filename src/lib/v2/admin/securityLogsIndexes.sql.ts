/**
 * SOURCE FIXTURE — Security Events admin query-support migration.
 *
 * STATUS: APPLIED LIVE as migration version `20260728101447`. The
 * canonical body lives at
 * `supabase/migrations/20260728123000_security_logs_admin_query_support.sql`.
 * The embedded `SECURITY_LOGS_INDEXES_SQL` below is a mirror; the
 * contract test enforces normalized byte parity between the two.
 *
 * POST-APPLY LIVE EVIDENCE (recorded 2026-07-28):
 *   • normalization_candidates = 0 and all_severity_mismatches = 0
 *     after apply (117 rows normalized from top-level 'info' →
 *     details->>'severity').
 *   • 7-day top-level `severity = 'high'` count = 2; both
 *     suspicious_activity rows now visible in the admin preview.
 *   • Live indexes present exactly:
 *     `idx_security_logs_created_at_desc`,
 *     `idx_security_logs_actionable_created_at`,
 *     `idx_security_logs_action_created_at_desc`
 *     (in addition to the pre-existing PK / category / severity
 *     indexes).
 *   • Live EXPLAIN for the default 24h noise-excluded ordered
 *     LIMIT 50 query now uses Index Scan on
 *     `idx_security_logs_actionable_created_at`, startup cost 0.29,
 *     no Sort (prior startup cost was ~3558.54 Seq Scan + Sort).
 *
 * TARGET TABLE — public.security_logs
 *   • ~52k rows / ~23 MB (as of 2026-07-28)

 *   • Existing indexes: PK(id), idx_security_logs_category(event_category),
 *     idx_security_logs_severity(severity)
 *   • Missing: any index on created_at or action
 *
 * QUERY SHAPES SERVED (from SecurityMonitoringDashboard.tsx):
 *
 *   Q1 · Default list (hot path):
 *     WHERE created_at >= now() - <window>
 *       AND action NOT IN ('route_access','developer_tools_opened')
 *     ORDER BY created_at DESC LIMIT 50
 *
 *   Q2 · All-events list (opt-in):
 *     WHERE created_at >= now() - <window>
 *     ORDER BY created_at DESC LIMIT 50
 *
 *   Q3 · 24h metric counts (count-only, head:true):
 *     SELECT count(*) WHERE created_at >= now() - '24 hours'
 *       [AND severity = ?]  ← existing severity index composes fine
 *
 *   Q4 · Explicit action drill-down:
 *     WHERE created_at >= now() - <window> AND action = ?
 *     ORDER BY created_at DESC LIMIT 50
 *
 * INDEX PLAN — exactly three targeted indexes:
 *
 *   I1  idx_security_logs_created_at_desc
 *       ON public.security_logs (created_at DESC)
 *
 *   I2  idx_security_logs_actionable_created_at
 *       ON public.security_logs (created_at DESC)
 *       WHERE action NOT IN ('route_access','developer_tools_opened')
 *
 *   I3  idx_security_logs_action_created_at_desc
 *       ON public.security_logs (action, created_at DESC)
 *       → serves Q4: exact-equality on `action` plus ORDER BY
 *         created_at DESC LIMIT is satisfied by a single Index Scan
 *         without a follow-up Sort.
 *
 * WRITE OVERHEAD: three additional B-tree indexes on an append-only
 * table. Same total index count as the earlier draft (the composite
 * replaces the action-only index).
 *
 * INDEXES INTENTIONALLY NOT ADDED:
 *   • No `idx_security_logs_action` (action-only). Superseded by I3
 *     which additionally supports the LIMIT/ORDER without a Sort.
 *   • No composite (severity, created_at) or (event_category, created_at)
 *     — existing single-column indexes already cover those filters.
 *   • No JSONB / details index — the dashboard reads top-level columns.
 *
 * IDEMPOTENCY: every DDL uses CREATE INDEX IF NOT EXISTS. The one-time
 * normalization UPDATE has a WHERE predicate that becomes vacuous
 * after the first apply (see below).
 *
 * ROLLBACK:
 *   DROP INDEX IF EXISTS public.idx_security_logs_created_at_desc;
 *   DROP INDEX IF EXISTS public.idx_security_logs_actionable_created_at;
 *   DROP INDEX IF EXISTS public.idx_security_logs_action_created_at_desc;
 *   (No auto-rollback for the normalization UPDATE.)
 */

export const SECURITY_LOGS_INDEXES_MIGRATION = {
  version: "20260728123000",
  name: "security_logs_admin_query_support",
  filename: "20260728123000_security_logs_admin_query_support.sql",
  migrationPath:
    "supabase/migrations/20260728123000_security_logs_admin_query_support.sql",
  applied: false,
  drafted: true,
} as const;

export interface PlannedSecurityLogsIndex {
  readonly name: string;
  readonly table: "security_logs";
  readonly definition: string;
  readonly purpose: string;
}

export const SECURITY_LOGS_PLANNED_INDEXES: readonly PlannedSecurityLogsIndex[] = [
  {
    name: "idx_security_logs_created_at_desc",
    table: "security_logs",
    definition:
      "CREATE INDEX IF NOT EXISTS idx_security_logs_created_at_desc ON public.security_logs (created_at DESC)",
    purpose:
      "time-window bound + ORDER BY created_at DESC LIMIT for the all-events list and 24h metric counts",
  },
  {
    name: "idx_security_logs_actionable_created_at",
    table: "security_logs",
    definition:
      "CREATE INDEX IF NOT EXISTS idx_security_logs_actionable_created_at ON public.security_logs (created_at DESC) WHERE action NOT IN ('route_access','developer_tools_opened')",
    purpose:
      "default noise-excluded dashboard list; partial index confined to the actionable subset",
  },
  {
    name: "idx_security_logs_action_created_at_desc",
    table: "security_logs",
    definition:
      "CREATE INDEX IF NOT EXISTS idx_security_logs_action_created_at_desc ON public.security_logs (action, created_at DESC)",
    purpose:
      "explicit action drill-down: exact action= plus ORDER BY created_at DESC LIMIT satisfied by a single Index Scan (no follow-up Sort)",
  },
] as const;

/** Existing live indexes that this migration must NOT duplicate. */
export const SECURITY_LOGS_EXISTING_INDEXES: readonly string[] = [
  "idx_security_logs_category",
  "idx_security_logs_severity",
] as const;

/**
 * One-time legacy severity normalization (see doc §Normalization).
 *
 * Live evidence at draft time:
 *   • 53,865 total rows.
 *   • 117 rows carry details->>'severity' and all 117 disagree with
 *     the top-level column (65 medium + 52 high; 0 critical).
 *   • Zero rows carry details->>'event_category' — no category backfill.
 *
 * Guards: severity = 'info' AND details->>'severity' IN allowlist.
 * Idempotence: after apply the WHERE no longer matches → zero rows.
 */
export const SECURITY_LOGS_LEGACY_SEVERITY_ALLOWLIST: readonly string[] = [
  "medium",
  "high",
  "critical",
] as const;

export const SECURITY_LOGS_LEGACY_SEVERITY_EXPECTED_AFFECTED = 117 as const;

export const SECURITY_LOGS_LEGACY_SEVERITY_NORMALIZATION_SQL = `-- One-time bounded normalization of legacy details->>'severity' values
-- into the authoritative top-level column. Idempotent (see fixture doc).
--
-- PREFLIGHT (informational — does NOT fail the migration on drift):
--   SELECT count(*) AS expected_affected_rows
--   FROM public.security_logs
--   WHERE severity = 'info'
--     AND details->>'severity' IN ('medium','high','critical');
--   -- Expected at draft time: 117 (65 medium + 52 high, 0 critical).
--
UPDATE public.security_logs
SET severity = details->>'severity'
WHERE severity = 'info'
  AND details->>'severity' IN ('medium','high','critical');
--
-- POSTCONDITION (informational — verify manually after apply):
--   SELECT count(*) FROM public.security_logs
--   WHERE severity = 'info' AND details->>'severity' IN ('medium','high','critical');
--   -- Expect 0 after successful application.`;

export const SECURITY_LOGS_INDEXES_SQL = `-- 20260728123000_security_logs_admin_query_support.sql
-- SOURCE-ONLY DRAFT. Do NOT apply without review. Idempotent.
--
-- Two independent concerns, applied in this file together because both
-- serve the corrected Security Events admin dashboard:
--   1) Query-support indexes on public.security_logs.
--   2) Bounded one-time normalization of legacy details->>'severity'
--      values into the authoritative top-level column.
--
-- See docs/security/SECURITY_LOGS_INDEX_PLAN_2026-07-28.md for the
-- before-plan evidence, per-query rationale, normalization scope, and
-- post-apply verification steps.

-- ── 1) Query-support indexes ─────────────────────────────────────────

${SECURITY_LOGS_PLANNED_INDEXES.map((i) => `${i.definition};`).join("\n\n")}

-- ── 2) Legacy severity normalization ─────────────────────────────────

${SECURITY_LOGS_LEGACY_SEVERITY_NORMALIZATION_SQL}
`;

export const SECURITY_LOGS_INDEX_PLAN = {
  migration: SECURITY_LOGS_INDEXES_MIGRATION,
  indexes: SECURITY_LOGS_PLANNED_INDEXES,
  existing: SECURITY_LOGS_EXISTING_INDEXES,
  legacySeverityAllowlist: SECURITY_LOGS_LEGACY_SEVERITY_ALLOWLIST,
  legacySeverityExpectedAffected:
    SECURITY_LOGS_LEGACY_SEVERITY_EXPECTED_AFFECTED,
  legacySeverityNormalizationSql:
    SECURITY_LOGS_LEGACY_SEVERITY_NORMALIZATION_SQL,
  sql: SECURITY_LOGS_INDEXES_SQL,
} as const;
