/**
 * SOURCE FIXTURE — Security Events admin performance indexes.
 *
 * STATUS: DRAFTED, NOT APPLIED LIVE. Source-only. Not wired to the
 * supabase--migration tool in this pass. A human must review the SQL
 * below and the accompanying note
 * (`docs/security/SECURITY_LOGS_INDEX_PLAN_2026-07-28.md`) before any
 * live application. After application, EXPLAIN must be re-run to
 * confirm index adoption before claiming any improvement.
 *
 * TARGET TABLE — public.security_logs
 *   • ~52k rows / ~23 MB (as of 2026-07-28)
 *   • Existing indexes: PK(id), idx_security_logs_category(event_category),
 *     idx_security_logs_severity(severity)
 *   • Missing: any index on created_at or action
 *
 * QUERY SHAPES SERVED (from SecurityMonitoringDashboard.tsx):
 *
 *   Q1 · Default list (hot path, hits every dashboard render):
 *     WHERE created_at >= now() - <window>
 *       AND action NOT IN ('route_access','developer_tools_opened')
 *     ORDER BY created_at DESC LIMIT 50
 *
 *   Q2 · All-events list (opt-in):
 *     WHERE created_at >= now() - <window>
 *     ORDER BY created_at DESC LIMIT 50
 *
 *   Q3 · 24h metric counts (fixed 24h window, count-only, head:true):
 *     SELECT count(*) WHERE created_at >= now() - '24 hours'
 *       [AND severity = ?]  ← existing severity index composes fine
 *
 *   Q4 · Explicit action filter (rare, admin drill-down):
 *     WHERE created_at >= now() - <window> AND action = ?
 *     ORDER BY created_at DESC LIMIT 50
 *
 * INDEX PLAN (three targeted indexes, no duplicates of existing
 * severity/category indexes):
 *
 *   I1  idx_security_logs_created_at_desc
 *       ON public.security_logs (created_at DESC)
 *       → serves Q2 and Q3 directly; also composes with the existing
 *         severity/category indexes for filtered metric counts.
 *
 *   I2  idx_security_logs_actionable_created_at
 *       ON public.security_logs (created_at DESC)
 *       WHERE action NOT IN ('route_access','developer_tools_opened')
 *       → partial index sized to the actionable subset only. Q1 is the
 *         default dashboard view, so this pays for its own maintenance
 *         cost quickly and keeps the ordering step free.
 *
 *   I3  idx_security_logs_action
 *       ON public.security_logs (action)
 *       → serves Q4 explicit action drill-down. B-tree on a low-arity
 *         text column; small and cheap.
 *
 * WRITE OVERHEAD: security_logs is append-only. Three additional
 * B-tree indexes (one partial) add roughly three index inserts per
 * event. Acceptable given the read-side wins.
 *
 * INDEXES INTENTIONALLY NOT ADDED:
 *   • No composite (severity, created_at) or (event_category, created_at)
 *     — existing single-column severity/category indexes already exist
 *     and can be combined with I1 via bitmap AND; adding wide composites
 *     would duplicate coverage.
 *   • No index on details JSONB paths — the dashboard reads top-level
 *     severity/event_category columns per the recent correction.
 *
 * IDEMPOTENCY: every statement uses CREATE INDEX IF NOT EXISTS.
 * Re-applying the file is a no-op.
 *
 * ROLLBACK:
 *   DROP INDEX IF EXISTS public.idx_security_logs_created_at_desc;
 *   DROP INDEX IF EXISTS public.idx_security_logs_actionable_created_at;
 *   DROP INDEX IF EXISTS public.idx_security_logs_action;
 */

export const SECURITY_LOGS_INDEXES_MIGRATION = {
  version: "20260728123000",
  name: "security_logs_admin_query_indexes",
  filename: "20260728123000_security_logs_admin_query_indexes.sql",
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
    name: "idx_security_logs_action",
    table: "security_logs",
    definition:
      "CREATE INDEX IF NOT EXISTS idx_security_logs_action ON public.security_logs (action)",
    purpose: "explicit action-slug drill-down filter",
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
 *   • 53,865 total rows in public.security_logs.
 *   • 117 rows carry details->>'severity' and all 117 disagree with the
 *     authoritative top-level `severity` column:
 *         65 rows: top-level 'info', details 'medium'
 *         52 rows: top-level 'info', details 'high'
 *   • Zero rows have details->>'event_category', so no category
 *     backfill is required.
 *
 * Guards:
 *   • Only update rows whose top-level severity is exactly 'info'.
 *     Non-'info' top-level values are treated as already authoritative
 *     and are never overwritten.
 *   • The details value must be in an explicit allowlist —
 *     ('medium','high','critical'). Any other string is ignored so a
 *     stray tag cannot promote a row to an arbitrary severity.
 *   • event_category is not touched.
 *
 * Idempotence: after the first apply the affected rows no longer match
 *   `severity = 'info'`, so re-running the migration updates zero rows.
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

export const SECURITY_LOGS_INDEXES_SQL = `-- 20260728123000_security_logs_admin_query_indexes.sql
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
