
DO $rehearsal$
DECLARE
  v_comb text;
  v_first jsonb;
  v_second jsonb;
  v_ent_mid int; v_cred_mid int; v_thr_mid int; v_aud_mid int;
  v_ent_after int; v_cred_after int; v_aud_after int;
  v_pre_ent int; v_pre_cred int; v_pre_aud int;
  v_post_ent int; v_post_cred int; v_post_aud int;
BEGIN
  -- Baseline (before savepoint)
  SELECT count(*) INTO v_pre_ent FROM public.entitlements WHERE legacy_source IS NOT NULL;
  SELECT count(*) INTO v_pre_cred FROM public.lifetime_credit_entries WHERE legacy_transaction_id IS NOT NULL;
  SELECT count(*) INTO v_pre_aud FROM public.activity_events WHERE action='v2_legacy_migration_executed';
  RAISE NOTICE 'REHEARSAL_BASELINE ent=% credit=% audit=%', v_pre_ent, v_pre_cred, v_pre_aud;

  SELECT combined_hash INTO v_comb FROM private.v2_legacy_plan_hashes();
  RAISE NOTICE 'REHEARSAL_HASH combined=%', v_comb;

  -- Inner subtransaction that always rolls back
  BEGIN
    v_first := private.execute_v2_legacy_migration('EXECUTE_JOJOPROMPTS_V2_LEGACY_6B_2_R1', v_comb);
    RAISE NOTICE 'REHEARSAL_FIRST_CALL=%', v_first;

    SELECT count(*) INTO v_ent_mid FROM public.entitlements WHERE legacy_source IS NOT NULL;
    SELECT count(*) INTO v_cred_mid FROM public.lifetime_credit_entries WHERE legacy_transaction_id IS NOT NULL;
    SELECT count(*) INTO v_thr_mid FROM public.entitlements
     WHERE grant_reason='lifetime_threshold'::public.v2_grant_reason
       AND scope='library'::public.v2_entitlement_scope AND revoked_at IS NULL;
    SELECT count(*) INTO v_aud_mid FROM public.activity_events WHERE action='v2_legacy_migration_executed';
    RAISE NOTICE 'REHEARSAL_INTERMEDIATE ent=% credit=% threshold=% audit=%',
      v_ent_mid, v_cred_mid, v_thr_mid, v_aud_mid;

    v_second := private.execute_v2_legacy_migration('EXECUTE_JOJOPROMPTS_V2_LEGACY_6B_2_R1', v_comb);
    RAISE NOTICE 'REHEARSAL_SECOND_CALL=%', v_second;

    SELECT count(*) INTO v_ent_after FROM public.entitlements WHERE legacy_source IS NOT NULL;
    SELECT count(*) INTO v_cred_after FROM public.lifetime_credit_entries WHERE legacy_transaction_id IS NOT NULL;
    SELECT count(*) INTO v_aud_after FROM public.activity_events WHERE action='v2_legacy_migration_executed';
    RAISE NOTICE 'REHEARSAL_AFTER_SECOND ent=% credit=% audit=%',
      v_ent_after, v_cred_after, v_aud_after;

    -- Force rollback of this inner subtransaction
    RAISE EXCEPTION 'REHEARSAL_INTENTIONAL_ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'REHEARSAL_INTENTIONAL_ROLLBACK' THEN
      RAISE NOTICE 'REHEARSAL_UNEXPECTED_ERROR sqlstate=% msg=%', SQLSTATE, SQLERRM;
      RAISE;
    END IF;
    RAISE NOTICE 'REHEARSAL_ROLLED_BACK cleanly';
  END;

  -- Post-baseline (after rollback of inner subtransaction)
  SELECT count(*) INTO v_post_ent FROM public.entitlements WHERE legacy_source IS NOT NULL;
  SELECT count(*) INTO v_post_cred FROM public.lifetime_credit_entries WHERE legacy_transaction_id IS NOT NULL;
  SELECT count(*) INTO v_post_aud FROM public.activity_events WHERE action='v2_legacy_migration_executed';
  RAISE NOTICE 'REHEARSAL_POST_ROLLBACK ent=% credit=% audit=%', v_post_ent, v_post_cred, v_post_aud;

  IF v_post_ent <> v_pre_ent OR v_post_cred <> v_pre_cred OR v_post_aud <> v_pre_aud THEN
    RAISE EXCEPTION 'REHEARSAL_STATE_LEAKED';
  END IF;
END
$rehearsal$;
