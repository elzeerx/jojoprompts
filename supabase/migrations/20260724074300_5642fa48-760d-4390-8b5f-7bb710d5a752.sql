
CREATE TABLE IF NOT EXISTS private._rehearsal_log (
  id serial PRIMARY KEY,
  captured_at timestamptz NOT NULL DEFAULT now(),
  label text NOT NULL,
  payload jsonb NOT NULL
);
GRANT USAGE ON SCHEMA private TO supabase_read_only_user;
GRANT SELECT ON private._rehearsal_log TO supabase_read_only_user;

DO $rehearsal$
DECLARE
  v_comb text;
  v_first jsonb; v_second jsonb;
  v_ent_mid int; v_cred_mid int; v_thr_mid int; v_aud_mid int;
  v_ent_after int; v_cred_after int; v_aud_after int;
  v_pre_ent int; v_pre_cred int; v_pre_aud int;
  v_post_ent int; v_post_cred int; v_post_aud int;
BEGIN
  SELECT count(*) INTO v_pre_ent FROM public.entitlements WHERE legacy_source IS NOT NULL;
  SELECT count(*) INTO v_pre_cred FROM public.lifetime_credit_entries WHERE legacy_transaction_id IS NOT NULL;
  SELECT count(*) INTO v_pre_aud FROM public.activity_events WHERE action='v2_legacy_migration_executed';

  SELECT combined_hash INTO v_comb FROM private.v2_legacy_plan_hashes();

  BEGIN
    v_first := private.execute_v2_legacy_migration('EXECUTE_JOJOPROMPTS_V2_LEGACY_6B_2_R1', v_comb);
    SELECT count(*) INTO v_ent_mid FROM public.entitlements WHERE legacy_source IS NOT NULL;
    SELECT count(*) INTO v_cred_mid FROM public.lifetime_credit_entries WHERE legacy_transaction_id IS NOT NULL;
    SELECT count(*) INTO v_thr_mid FROM public.entitlements
      WHERE grant_reason='lifetime_threshold'::public.v2_grant_reason
        AND scope='library'::public.v2_entitlement_scope AND revoked_at IS NULL;
    SELECT count(*) INTO v_aud_mid FROM public.activity_events WHERE action='v2_legacy_migration_executed';

    v_second := private.execute_v2_legacy_migration('EXECUTE_JOJOPROMPTS_V2_LEGACY_6B_2_R1', v_comb);
    SELECT count(*) INTO v_ent_after FROM public.entitlements WHERE legacy_source IS NOT NULL;
    SELECT count(*) INTO v_cred_after FROM public.lifetime_credit_entries WHERE legacy_transaction_id IS NOT NULL;
    SELECT count(*) INTO v_aud_after FROM public.activity_events WHERE action='v2_legacy_migration_executed';

    RAISE EXCEPTION 'REHEARSAL_INTENTIONAL_ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'REHEARSAL_INTENTIONAL_ROLLBACK' THEN
      RAISE;
    END IF;
  END;

  SELECT count(*) INTO v_post_ent FROM public.entitlements WHERE legacy_source IS NOT NULL;
  SELECT count(*) INTO v_post_cred FROM public.lifetime_credit_entries WHERE legacy_transaction_id IS NOT NULL;
  SELECT count(*) INTO v_post_aud FROM public.activity_events WHERE action='v2_legacy_migration_executed';

  INSERT INTO private._rehearsal_log(label, payload) VALUES
    ('rehearsal_6b2_r1', jsonb_build_object(
      'combined_hash', v_comb,
      'baseline', jsonb_build_object('ent', v_pre_ent, 'credit', v_pre_cred, 'audit', v_pre_aud),
      'first_call', v_first,
      'intermediate', jsonb_build_object('ent', v_ent_mid, 'credit', v_cred_mid, 'threshold', v_thr_mid, 'audit', v_aud_mid),
      'second_call', v_second,
      'after_second', jsonb_build_object('ent', v_ent_after, 'credit', v_cred_after, 'audit', v_aud_after),
      'post_rollback', jsonb_build_object('ent', v_post_ent, 'credit', v_post_cred, 'audit', v_post_aud),
      'state_leaked', (v_post_ent <> v_pre_ent OR v_post_cred <> v_pre_cred OR v_post_aud <> v_pre_aud)
    ));
END
$rehearsal$;
