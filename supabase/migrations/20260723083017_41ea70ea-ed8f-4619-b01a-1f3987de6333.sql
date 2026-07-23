-- Corrective: strip anon + service_role EXECUTE from admin RPCs.
-- Supabase default privileges auto-grant EXECUTE to these roles on new public functions.
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN (
      'v2_admin_order_metrics','v2_admin_list_orders','v2_admin_get_order_detail',
      'v2_admin_list_payment_events','v2_admin_get_payment_event',
      'v2_admin_list_entitlements','v2_admin_list_refunds','v2_admin_list_recovery',
      '_v2_require_admin','_v2_mask_email','_v2_bounded_limit'
    )
  LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION '||fn.sig||' FROM PUBLIC, anon, service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION '||fn.sig||' TO authenticated';
  END LOOP;
END $$;