
-- Phase 4A - H. Safety cleanup:
-- Only the correlated wrappers call these two functions now.
-- Wrappers are SECURITY DEFINER so they can still invoke them internally
-- regardless of the caller's own EXECUTE privilege.
-- Keep anon/authenticated/PUBLIC revoked (already the case); remove
-- service_role EXECUTE so no external client can call them directly.
REVOKE ALL ON FUNCTION public.v2_apply_verified_refund(uuid, uuid, text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.v2_mark_verified_refund_failure(uuid, uuid, text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
