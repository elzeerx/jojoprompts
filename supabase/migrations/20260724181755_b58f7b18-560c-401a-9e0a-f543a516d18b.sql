
-- Phase 6E2 correction: Supabase default_privileges grant EXECUTE on public
-- functions to anon and authenticated explicitly, so REVOKE FROM PUBLIC does
-- not remove those. Revoke from each role by name.

REVOKE EXECUTE ON FUNCTION public.v2_internal_create_package_scan(uuid, text, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.v2_internal_claim_scan_items(uuid, int) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.v2_internal_record_scan_submission(uuid, text, timestamptz) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.v2_internal_apply_scan_item_result(uuid, public.v2_scan_status, int, int, int, int, jsonb, timestamptz, text) FROM anon, authenticated;

-- Also guarantee the table stays service_role only.
REVOKE ALL ON TABLE public.package_scan_items FROM anon, authenticated;
