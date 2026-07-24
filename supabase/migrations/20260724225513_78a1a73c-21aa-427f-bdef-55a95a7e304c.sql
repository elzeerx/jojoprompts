-- Forward-only privilege hardening for the admin activity RPCs.
-- Prior migration revoked EXECUTE from PUBLIC but not from anon explicitly.
-- Current Supabase guidance requires revoking from anon as an explicit role too.

REVOKE EXECUTE ON FUNCTION public.v2_admin_list_activity_events(
  text[], text[], text[], uuid, uuid, text, timestamptz, timestamptz, int, int
) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.v2_admin_get_activity_event(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.v2_admin_list_activity_events(
  text[], text[], text[], uuid, uuid, text, timestamptz, timestamptz, int, int
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.v2_admin_get_activity_event(uuid)
  TO authenticated;

-- Assertion: verify the exact privilege posture we require.
DO $$
DECLARE
  v_bad text;
BEGIN
  SELECT string_agg(
    format('%s: anon=%s authenticated=%s', proc, anon_ex, auth_ex),
    E'\n'
  )
  INTO v_bad
  FROM (
    SELECT
      p.oid::regprocedure::text AS proc,
      has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_ex,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_ex
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('v2_admin_list_activity_events','v2_admin_get_activity_event')
  ) s
  WHERE anon_ex = true OR auth_ex = false;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Admin activity RPC privilege assertion failed: %', v_bad;
  END IF;
END
$$;
