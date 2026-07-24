
-- =============================================================================
-- Phase 6B.3 — Post-migration verification (read-only, admin-only)
-- Compares the deterministic private plan against the migration-owned rows
-- written by private.execute_v2_legacy_migration (policy 6B.2-r1).
-- No writes. No PII. Does not modify any prior migration, hash, or policy.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.v2_admin_migration_verification()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid;
  v_ent_hash text;
  v_cred_hash text;
  v_comb_hash text;
  v_sample_limit int := 25;

  v_expected_ent_rows int;
  v_expected_ent_users int;
  v_expected_cred_rows int;
  v_expected_cred_users int;

  v_actual_ent_rows int;
  v_actual_ent_users int;
  v_actual_cred_rows int;
  v_actual_cred_users int;

  v_missing_ent_total int;
  v_extra_ent_total int;
  v_mismatched_ent_total int;
  v_missing_cred_total int;
  v_extra_cred_total int;
  v_mismatched_cred_total int;

  v_missing_ent_sample jsonb;
  v_extra_ent_sample jsonb;
  v_mismatched_ent_sample jsonb;
  v_missing_cred_sample jsonb;
  v_extra_cred_sample jsonb;
  v_mismatched_cred_sample jsonb;

  v_audit_id uuid;
  v_audit_at timestamptz;
  v_audit_actor uuid;
  v_audit_combined_hash text;
  v_audit_ent_hash text;
  v_audit_cred_hash text;

  v_hashes_match text;  -- 'match' | 'mismatch' | 'not_persisted'
BEGIN
  -- Fail closed: authenticated admin only. Captures actor via auth.uid() before
  -- any privilege-dependent work. Returns the acting admin's uid or raises.
  v_actor := public._v2_require_admin();

  -- Current deterministic plan hashes (live).
  SELECT entitlement_hash, credit_hash, combined_hash
    INTO v_ent_hash, v_cred_hash, v_comb_hash
    FROM private.v2_legacy_plan_hashes();

  -- Latest recorded migration execution audit event (if any).
  SELECT ae.id, ae.created_at, ae.actor_user_id,
         (ae.metadata->>'combined_plan_hash'),
         (ae.metadata->>'entitlement_plan_hash'),
         (ae.metadata->>'credit_plan_hash')
    INTO v_audit_id, v_audit_at, v_audit_actor,
         v_audit_combined_hash, v_audit_ent_hash, v_audit_cred_hash
    FROM public.activity_events ae
   WHERE ae.action = 'v2_legacy_migration_executed'
   ORDER BY ae.created_at DESC
   LIMIT 1;

  IF v_audit_combined_hash IS NULL THEN
    v_hashes_match := 'not_persisted';
  ELSIF v_audit_combined_hash = v_comb_hash THEN
    v_hashes_match := 'match';
  ELSE
    v_hashes_match := 'mismatch';
  END IF;

  -- ----------------------------------------------------------
  -- Expected counts (from the deterministic private plan)
  -- ----------------------------------------------------------
  SELECT count(*), count(DISTINCT user_id)
    INTO v_expected_ent_rows, v_expected_ent_users
    FROM private.v2_legacy_entitlement_plan();

  SELECT count(*), count(DISTINCT user_id)
    INTO v_expected_cred_rows, v_expected_cred_users
    FROM private.v2_legacy_credit_plan();

  -- ----------------------------------------------------------
  -- Actual counts (migration-owned rows only)
  -- Match the exact identifiers written by private.execute_v2_legacy_migration:
  --   - entitlements: legacy_source IS NOT NULL
  --                   grant_reason IN ('legacy_migration','lifetime_threshold')
  --                   (planned rows all use 'legacy_migration'; threshold uses
  --                    'lifetime_threshold' with legacy_source
  --                    'threshold:legacy_credit_6B_2_r1')
  --   - lifetime_credit_entries: legacy_transaction_id IS NOT NULL
  -- Expected/plan comparison is on planned 'legacy_migration' rows only.
  -- Threshold grants are reported separately under executor_extras.
  -- ----------------------------------------------------------
  SELECT count(*), count(DISTINCT user_id)
    INTO v_actual_ent_rows, v_actual_ent_users
    FROM public.entitlements
   WHERE legacy_source IS NOT NULL
     AND grant_reason = 'legacy_migration'::public.v2_grant_reason;

  SELECT count(*), count(DISTINCT user_id)
    INTO v_actual_cred_rows, v_actual_cred_users
    FROM public.lifetime_credit_entries
   WHERE legacy_transaction_id IS NOT NULL;

  -- ----------------------------------------------------------
  -- Drift: entitlements
  -- Natural key from executor idempotency clause:
  --   (user_id, legacy_source, scope, coalesce(collection_key,''),
  --    coalesce(resource_id,'00000000-...'))
  -- Compare additionally on granted_at, expires_at.
  -- ----------------------------------------------------------
  WITH plan AS (
    SELECT user_id,
           legacy_source,
           scope,
           collection_key,
           granted_at,
           expires_at
      FROM private.v2_legacy_entitlement_plan()
  ),
  actual AS (
    SELECT user_id,
           legacy_source,
           scope,
           collection_key,
           granted_at,
           expires_at,
           resource_id
      FROM public.entitlements
     WHERE legacy_source IS NOT NULL
       AND grant_reason = 'legacy_migration'::public.v2_grant_reason
  ),
  missing AS (
    SELECT p.user_id, p.legacy_source, p.scope::text AS scope,
           COALESCE(p.collection_key,'') AS collection_key
      FROM plan p
     WHERE NOT EXISTS (
       SELECT 1 FROM actual a
        WHERE a.user_id = p.user_id
          AND a.legacy_source = p.legacy_source
          AND a.scope = p.scope
          AND COALESCE(a.collection_key,'') = COALESCE(p.collection_key,'')
          AND COALESCE(a.resource_id, '00000000-0000-0000-0000-000000000000'::uuid)
              = '00000000-0000-0000-0000-000000000000'::uuid
     )
  ),
  extra AS (
    SELECT a.user_id, a.legacy_source, a.scope::text AS scope,
           COALESCE(a.collection_key,'') AS collection_key
      FROM actual a
     WHERE NOT EXISTS (
       SELECT 1 FROM plan p
        WHERE p.user_id = a.user_id
          AND p.legacy_source = a.legacy_source
          AND p.scope = a.scope
          AND COALESCE(p.collection_key,'') = COALESCE(a.collection_key,'')
     )
  ),
  mismatched AS (
    SELECT p.user_id, p.legacy_source, p.scope::text AS scope,
           COALESCE(p.collection_key,'') AS collection_key,
           jsonb_build_object(
             'planned_granted_at', p.granted_at,
             'actual_granted_at',  a.granted_at,
             'planned_expires_at', p.expires_at,
             'actual_expires_at',  a.expires_at
           ) AS diff
      FROM plan p
      JOIN actual a
        ON a.user_id = p.user_id
       AND a.legacy_source = p.legacy_source
       AND a.scope = p.scope
       AND COALESCE(a.collection_key,'') = COALESCE(p.collection_key,'')
     WHERE p.granted_at IS DISTINCT FROM a.granted_at
        OR p.expires_at IS DISTINCT FROM a.expires_at
  )
  SELECT
    (SELECT count(*) FROM missing),
    (SELECT count(*) FROM extra),
    (SELECT count(*) FROM mismatched),
    (SELECT COALESCE(jsonb_agg(to_jsonb(m)), '[]'::jsonb)
       FROM (SELECT * FROM missing ORDER BY user_id LIMIT v_sample_limit) m),
    (SELECT COALESCE(jsonb_agg(to_jsonb(e)), '[]'::jsonb)
       FROM (SELECT * FROM extra    ORDER BY user_id LIMIT v_sample_limit) e),
    (SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
       FROM (SELECT * FROM mismatched ORDER BY user_id LIMIT v_sample_limit) x)
    INTO v_missing_ent_total, v_extra_ent_total, v_mismatched_ent_total,
         v_missing_ent_sample, v_extra_ent_sample, v_mismatched_ent_sample;

  -- ----------------------------------------------------------
  -- Drift: lifetime_credit_entries
  -- Natural key: legacy_transaction_id. Compare user_id, amount_fils, reason.
  -- ----------------------------------------------------------
  WITH plan AS (
    SELECT legacy_transaction_id, user_id, amount_fils, reason
      FROM private.v2_legacy_credit_plan()
  ),
  actual AS (
    SELECT legacy_transaction_id, user_id, amount_fils, reason
      FROM public.lifetime_credit_entries
     WHERE legacy_transaction_id IS NOT NULL
  ),
  missing AS (
    SELECT p.legacy_transaction_id, p.user_id
      FROM plan p
     WHERE NOT EXISTS (
       SELECT 1 FROM actual a
        WHERE a.legacy_transaction_id = p.legacy_transaction_id
     )
  ),
  extra AS (
    SELECT a.legacy_transaction_id, a.user_id
      FROM actual a
     WHERE NOT EXISTS (
       SELECT 1 FROM plan p
        WHERE p.legacy_transaction_id = a.legacy_transaction_id
     )
  ),
  mismatched AS (
    SELECT p.legacy_transaction_id, p.user_id,
           jsonb_build_object(
             'planned_user_id',    p.user_id,
             'actual_user_id',     a.user_id,
             'planned_amount_fils', p.amount_fils,
             'actual_amount_fils',  a.amount_fils,
             'planned_reason',     p.reason,
             'actual_reason',      a.reason
           ) AS diff
      FROM plan p
      JOIN actual a ON a.legacy_transaction_id = p.legacy_transaction_id
     WHERE p.user_id IS DISTINCT FROM a.user_id
        OR p.amount_fils IS DISTINCT FROM a.amount_fils
        OR p.reason IS DISTINCT FROM a.reason
  )
  SELECT
    (SELECT count(*) FROM missing),
    (SELECT count(*) FROM extra),
    (SELECT count(*) FROM mismatched),
    (SELECT COALESCE(jsonb_agg(to_jsonb(m)), '[]'::jsonb)
       FROM (SELECT * FROM missing ORDER BY legacy_transaction_id LIMIT v_sample_limit) m),
    (SELECT COALESCE(jsonb_agg(to_jsonb(e)), '[]'::jsonb)
       FROM (SELECT * FROM extra    ORDER BY legacy_transaction_id LIMIT v_sample_limit) e),
    (SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
       FROM (SELECT * FROM mismatched ORDER BY legacy_transaction_id LIMIT v_sample_limit) x)
    INTO v_missing_cred_total, v_extra_cred_total, v_mismatched_cred_total,
         v_missing_cred_sample, v_extra_cred_sample, v_mismatched_cred_sample;

  RETURN jsonb_build_object(
    'policy_version', '6B.2-r1',
    'checked_at', now(),
    'checked_by_actor', v_actor,
    'sample_limit', v_sample_limit,
    'notes', 'Read-only comparison of private deterministic plan vs migration-owned rows. No PII returned.',
    'plan_hashes', jsonb_build_object(
      'entitlement_plan_hash', v_ent_hash,
      'credit_plan_hash', v_cred_hash,
      'combined_plan_hash', v_comb_hash
    ),
    'audit_event', jsonb_build_object(
      'id', v_audit_id,
      'executed_at', v_audit_at,
      'actor_user_id', v_audit_actor,
      'entitlement_plan_hash', v_audit_ent_hash,
      'credit_plan_hash', v_audit_cred_hash,
      'combined_plan_hash', v_audit_combined_hash
    ),
    'hashes_match', v_hashes_match,
    'expected', jsonb_build_object(
      'entitlement_rows', v_expected_ent_rows,
      'entitlement_unique_users', v_expected_ent_users,
      'credit_rows', v_expected_cred_rows,
      'credit_unique_users', v_expected_cred_users
    ),
    'actual', jsonb_build_object(
      'entitlement_rows', v_actual_ent_rows,
      'entitlement_unique_users', v_actual_ent_users,
      'credit_rows', v_actual_cred_rows,
      'credit_unique_users', v_actual_cred_users
    ),
    'executor_extras', jsonb_build_object(
      'active_lifetime_threshold_grants',
        (SELECT count(*)::int FROM public.entitlements
          WHERE grant_reason = 'lifetime_threshold'::public.v2_grant_reason
            AND scope = 'library'::public.v2_entitlement_scope
            AND revoked_at IS NULL),
      'entitlements_with_any_legacy_source_all_history',
        (SELECT count(*)::int FROM public.entitlements WHERE legacy_source IS NOT NULL),
      'credit_entries_with_legacy_transaction_id',
        (SELECT count(*)::int FROM public.lifetime_credit_entries WHERE legacy_transaction_id IS NOT NULL)
    ),
    'drift', jsonb_build_object(
      'entitlements', jsonb_build_object(
        'missing_total', v_missing_ent_total,
        'extra_total', v_extra_ent_total,
        'mismatched_total', v_mismatched_ent_total,
        'missing_sample', v_missing_ent_sample,
        'extra_sample', v_extra_ent_sample,
        'mismatched_sample', v_mismatched_ent_sample
      ),
      'credits', jsonb_build_object(
        'missing_total', v_missing_cred_total,
        'extra_total', v_extra_cred_total,
        'mismatched_total', v_mismatched_cred_total,
        'missing_sample', v_missing_cred_sample,
        'extra_sample', v_extra_cred_sample,
        'mismatched_sample', v_mismatched_cred_sample
      ),
      'total_drift',
        v_missing_ent_total + v_extra_ent_total + v_mismatched_ent_total
      + v_missing_cred_total + v_extra_cred_total + v_mismatched_cred_total
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.v2_admin_migration_verification() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.v2_admin_migration_verification() FROM anon;
GRANT EXECUTE ON FUNCTION public.v2_admin_migration_verification() TO authenticated;

COMMENT ON FUNCTION public.v2_admin_migration_verification() IS
  'Phase 6B.3 read-only admin verification. Compares private deterministic legacy plan vs migration-owned rows in public.entitlements and public.lifetime_credit_entries. Admin-only via public._v2_require_admin(). No writes. No PII.';
