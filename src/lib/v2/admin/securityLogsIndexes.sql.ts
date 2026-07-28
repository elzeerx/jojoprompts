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

export const SECURITY_LOGS_INDEXES_SQL = `-- 20260728123000_security_logs_admin_query_indexes.sql
-- SOURCE-ONLY DRAFT. Do NOT apply without review. Idempotent.
--
-- Targets the corrected Security Events admin dashboard queries
-- against public.security_logs. See
-- docs/security/SECURITY_LOGS_INDEX_PLAN_2026-07-28.md for the
-- before-plan evidence and post-apply verification steps.

${SECURITY_LOGS_PLANNED_INDEXES.map((i) => `${i.definition};`).join("\n\n")}
`;

export const SECURITY_LOGS_INDEX_PLAN = {
  migration: SECURITY_LOGS_INDEXES_MIGRATION,
  indexes: SECURITY_LOGS_PLANNED_INDEXES,
  existing: SECURITY_LOGS_EXISTING_INDEXES,
  sql: SECURITY_LOGS_INDEXES_SQL,
} as const;
