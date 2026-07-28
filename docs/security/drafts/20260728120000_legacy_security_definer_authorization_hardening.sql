-- 20260728120000_legacy_security_definer_authorization_hardening.sql
--
-- SOURCE-ONLY DRAFT. NOT APPLIED LIVE in this pass. A human must review
-- this file and docs/security/LEGACY_SECURITY_DEFINER_AUDIT_2026-07-28.md
-- before submission to the supabase migration tool.
--
-- NOTE ON FILE LOCATION: the Lovable build environment blocks direct
-- writes under `supabase/migrations/`. This physical file therefore
-- lives at `docs/security/drafts/` for reviewer inspection. When
-- approved, its byte-identical body will be submitted through the
-- supabase migration tool, which owns the canonical
-- `supabase/migrations/20260728120000_...sql` path.
--
-- Scope: schema `public`. Revoke browser (PUBLIC / anon / authenticated)
-- EXECUTE on 8 legacy SECURITY DEFINER helpers that live pg_proc
-- evidence shows are currently exposed to the `authenticated` role, and
-- retain / grant EXECUTE to `service_role` only. No function bodies,
-- signatures, or dependent RLS policies are modified.
--
-- Exact live signatures (from pg_proc at draft time):
--   TIER 1 · audit-log functions
--     public.log_sensitive_data_access(uuid, text, uuid, text[])
--     public.log_profile_access_attempt(uuid, text, boolean)
--   TIER 2 · unreachable legacy helpers
--     public.calculate_anomaly_score(uuid, text, jsonb)
--     public.confirm_user_email(uuid, boolean)
--     public.evaluate_compliance_status(text, jsonb)
--     public.evaluate_response_conditions(jsonb, jsonb)
--     public.is_super_admin(uuid)
--     public.user_has_any_role(uuid)
--
-- Explicitly EXCLUDED (already service_role-only per live pg_proc — no
-- change required, no statement emitted below):
--     public.execute_response_action(uuid, text, jsonb, jsonb)
--     public.trigger_automated_response(text, text, jsonb)
--     public.admin_delete_user_data(uuid, uuid)
--
-- Idempotence: `REVOKE EXECUTE` on an unprivileged role is a no-op and
-- `GRANT EXECUTE` to `service_role` on an already-granted function is a
-- no-op, so this file may be re-run safely. PostgreSQL does not support
-- `REVOKE ... IF EXISTS` for function privileges; do not add that
-- syntax.

-- ── TIER 1 · Audit-log functions ─────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.log_sensitive_data_access(uuid, text, uuid, text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_sensitive_data_access(uuid, text, uuid, text[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_sensitive_data_access(uuid, text, uuid, text[]) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.log_sensitive_data_access(uuid, text, uuid, text[]) TO service_role;

REVOKE EXECUTE ON FUNCTION public.log_profile_access_attempt(uuid, text, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_profile_access_attempt(uuid, text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_profile_access_attempt(uuid, text, boolean) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.log_profile_access_attempt(uuid, text, boolean) TO service_role;

-- ── TIER 2 · Unreachable legacy helpers ──────────────────────────────

REVOKE EXECUTE ON FUNCTION public.calculate_anomaly_score(uuid, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.calculate_anomaly_score(uuid, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_anomaly_score(uuid, text, jsonb) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.calculate_anomaly_score(uuid, text, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.confirm_user_email(uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_user_email(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.confirm_user_email(uuid, boolean) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.confirm_user_email(uuid, boolean) TO service_role;

REVOKE EXECUTE ON FUNCTION public.evaluate_compliance_status(text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.evaluate_compliance_status(text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.evaluate_compliance_status(text, jsonb) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.evaluate_compliance_status(text, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.evaluate_response_conditions(jsonb, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.evaluate_response_conditions(jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.evaluate_response_conditions(jsonb, jsonb) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.evaluate_response_conditions(jsonb, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.is_super_admin(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.user_has_any_role(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_has_any_role(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_has_any_role(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.user_has_any_role(uuid) TO service_role;

-- TIER 3 · Customer / RLS helpers (can_access_prompt, can_access_tier,
-- can_manage_prompts, get_user_subscription_tier, has_role,
-- user_has_active_subscription) are intentionally NOT modified here.
-- See docs/security/LEGACY_SECURITY_DEFINER_AUDIT_2026-07-28.md §Group C
-- for the follow-up guard proposal to be delivered in a separate
-- reviewed migration.
