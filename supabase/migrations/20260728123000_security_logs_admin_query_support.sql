-- 20260728123000_security_logs_admin_query_support.sql
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

CREATE INDEX IF NOT EXISTS idx_security_logs_created_at_desc ON public.security_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_logs_actionable_created_at ON public.security_logs (created_at DESC) WHERE action NOT IN ('route_access','developer_tools_opened');

CREATE INDEX IF NOT EXISTS idx_security_logs_action_created_at_desc ON public.security_logs (action, created_at DESC);

-- ── 2) Legacy severity normalization ─────────────────────────────────

-- One-time bounded normalization of legacy details->>'severity' values
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
--   -- Expect 0 after successful application.
