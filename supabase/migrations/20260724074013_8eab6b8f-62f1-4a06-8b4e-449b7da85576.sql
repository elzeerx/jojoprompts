
-- =============================================================================
-- Phase 6B.2 — Private legacy migration executor (policy 6B.2-r1)
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon, authenticated, service_role;

-- Entitlement plan --------------------------------------------------
DROP FUNCTION IF EXISTS private.v2_legacy_entitlement_plan();
CREATE FUNCTION private.v2_legacy_entitlement_plan()
RETURNS TABLE (
  user_id           uuid,
  scope             public.v2_entitlement_scope,
  collection_key    text,
  grant_reason      public.v2_grant_reason,
  granted_at        timestamptz,
  expires_at        timestamptz,
  legacy_source     text,
  source_tier       text,
  is_lifetime_grant boolean
)
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
WITH s AS (
  SELECT us.id                                    AS sub_id,
         us.user_id,
         lower(COALESCE(pl.tier,'unknown'))       AS tier,
         COALESCE(pl.is_lifetime,false)           AS is_lifetime,
         lower(COALESCE(us.status,''))            AS status,
         us.start_date,
         us.end_date
    FROM public.user_subscriptions us
    LEFT JOIN public.subscription_plans pl ON pl.id = us.plan_id
   WHERE us.user_id IS NOT NULL
),
positive AS (
  SELECT * FROM s WHERE status IN ('active','completed','paid','succeeded')
),
lifetime_rows AS (
  SELECT p.* FROM positive p
   WHERE p.is_lifetime
     AND p.tier IN ('premium','ultimate')
     AND (p.end_date IS NULL OR p.end_date >= now())
),
lifetime_ranked AS (
  SELECT lr.*,
         row_number() OVER (
           PARTITION BY lr.user_id
           ORDER BY CASE lr.tier WHEN 'ultimate' THEN 0 WHEN 'premium' THEN 1 ELSE 2 END,
                    lr.start_date NULLS LAST,
                    lr.sub_id
         ) AS rn
    FROM lifetime_rows lr
),
lifetime_pick AS (SELECT * FROM lifetime_ranked WHERE rn = 1),
lifetime_users AS (SELECT user_id FROM lifetime_pick),
standard_rows AS (
  SELECT p.* FROM positive p
   WHERE NOT p.is_lifetime AND p.tier='standard'
     AND (p.end_date IS NULL OR p.end_date >= now())
     AND p.user_id NOT IN (SELECT user_id FROM lifetime_users)
),
standard_ranked AS (
  SELECT sr.*,
         row_number() OVER (
           PARTITION BY sr.user_id
           ORDER BY sr.end_date DESC NULLS LAST, sr.start_date NULLS LAST, sr.sub_id
         ) AS rn
    FROM standard_rows sr
),
standard_pick AS (SELECT * FROM standard_ranked WHERE rn = 1),
standard_users AS (SELECT user_id FROM standard_pick),
basic_rows AS (
  SELECT p.* FROM positive p
   WHERE NOT p.is_lifetime AND p.tier='basic'
     AND (p.end_date IS NULL OR p.end_date >= now())
     AND p.user_id NOT IN (SELECT user_id FROM lifetime_users)
     AND p.user_id NOT IN (SELECT user_id FROM standard_users)
),
basic_ranked AS (
  SELECT br.*,
         row_number() OVER (
           PARTITION BY br.user_id
           ORDER BY br.end_date DESC NULLS LAST, br.start_date NULLS LAST, br.sub_id
         ) AS rn
    FROM basic_rows br
),
basic_pick AS (SELECT * FROM basic_ranked WHERE rn = 1),
lifetime_out AS (
  SELECT lp.user_id,
         'library'::public.v2_entitlement_scope     AS scope,
         NULL::text                                 AS collection_key,
         'legacy_migration'::public.v2_grant_reason AS grant_reason,
         COALESCE(lp.start_date, now())             AS granted_at,
         NULL::timestamptz                          AS expires_at,
         'subscription:' || lp.sub_id::text         AS legacy_source,
         lp.tier                                    AS source_tier,
         true                                       AS is_lifetime_grant
    FROM lifetime_pick lp
),
standard_out AS (
  SELECT sp.user_id,
         'collection'::public.v2_entitlement_scope  AS scope,
         ck.k                                       AS collection_key,
         'legacy_migration'::public.v2_grant_reason AS grant_reason,
         COALESCE(sp.start_date, now())             AS granted_at,
         sp.end_date                                AS expires_at,
         'subscription:' || sp.sub_id::text         AS legacy_source,
         'standard'::text                           AS source_tier,
         false                                      AS is_lifetime_grant
    FROM standard_pick sp
    CROSS JOIN (VALUES ('chatgpt_prompts'), ('midjourney_prompts')) ck(k)
),
basic_out AS (
  SELECT bp.user_id,
         'collection'::public.v2_entitlement_scope  AS scope,
         'chatgpt_prompts'::text                    AS collection_key,
         'legacy_migration'::public.v2_grant_reason AS grant_reason,
         COALESCE(bp.start_date, now())             AS granted_at,
         bp.end_date                                AS expires_at,
         'subscription:' || bp.sub_id::text         AS legacy_source,
         'basic'::text                              AS source_tier,
         false                                      AS is_lifetime_grant
    FROM basic_pick bp
),
all_out AS (
  SELECT * FROM lifetime_out
  UNION ALL SELECT * FROM standard_out
  UNION ALL SELECT * FROM basic_out
)
SELECT user_id, scope, collection_key, grant_reason, granted_at, expires_at,
       legacy_source, source_tier, is_lifetime_grant
  FROM all_out
 ORDER BY user_id, scope, COALESCE(collection_key,''), legacy_source;
$$;
REVOKE ALL ON FUNCTION private.v2_legacy_entitlement_plan() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.v2_legacy_entitlement_plan() FROM anon, authenticated, service_role;

-- Credit plan (raw per-row) ----------------------------------------
DROP FUNCTION IF EXISTS private.v2_legacy_credit_plan();
CREATE FUNCTION private.v2_legacy_credit_plan()
RETURNS TABLE (
  legacy_transaction_id uuid,
  user_id               uuid,
  amount_fils           integer,
  occurred_at           timestamptz,
  reason                text,
  gateway               text,
  policy_note           text
)
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
WITH
pp_pos AS (
  SELECT t.* FROM public.transactions t
   WHERE lower(COALESCE(t.payment_gateway,'')) = 'paypal'
     AND lower(COALESCE(t.status,'')) IN ('completed','captured','success','paid')
     AND COALESCE(t.amount_usd,0) > 0
     AND t.user_id IS NOT NULL
),
pp_verified AS (
  SELECT p.* FROM pp_pos p
   WHERE EXISTS (SELECT 1 FROM public.user_subscriptions us
                  WHERE us.transaction_id=p.id
                    AND lower(COALESCE(us.status,'')) IN ('active','completed','paid','succeeded'))
     AND NOT EXISTS (SELECT 1 FROM public.user_subscriptions us
                  WHERE us.transaction_id=p.id
                    AND lower(COALESCE(us.status,'')) IN ('cancelled','canceled','refunded','revoked','chargeback','charged_back'))
),
up_all AS (
  SELECT t.* FROM public.transactions t
   WHERE lower(COALESCE(t.payment_gateway,''))='upayments'
      OR t.upayments_invoice_id IS NOT NULL
      OR t.upayments_track_id IS NOT NULL
),
up_class AS (
  SELECT u.*,
    (SELECT lower(pl.tier) FROM public.user_subscriptions us
       JOIN public.subscription_plans pl ON pl.id=us.plan_id
      WHERE us.transaction_id=u.id
        AND lower(COALESCE(us.status,'')) IN ('active','completed','paid','succeeded')
      LIMIT 1) AS linked_tier,
    (SELECT pl.price_usd FROM public.user_subscriptions us
       JOIN public.subscription_plans pl ON pl.id=us.plan_id
      WHERE us.transaction_id=u.id
        AND lower(COALESCE(us.status,'')) IN ('active','completed','paid','succeeded')
      LIMIT 1) AS linked_plan_price_usd,
    EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.transaction_id=u.id
              AND lower(COALESCE(us.status,'')) IN ('cancelled','canceled','refunded','revoked','chargeback','charged_back')) AS has_neg_link,
    EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.transaction_id=u.id) AS any_link
    FROM up_all u
),
up_verified AS (
  SELECT c.*,
    CASE c.linked_tier WHEN 'basic' THEN 15000 WHEN 'standard' THEN 20000
                       WHEN 'premium' THEN 25000 WHEN 'ultimate' THEN 30000 END AS base_fils
    FROM up_class c
   WHERE lower(COALESCE(c.status,'')) IN ('completed','captured','success','paid')
     AND upper(COALESCE(c.currency,''))='KWD'
     AND COALESCE(c.amount_usd,0)>0
     AND c.linked_tier IN ('basic','standard','premium','ultimate')
     AND COALESCE(c.linked_plan_price_usd,0)>0
     AND (c.amount_usd/c.linked_plan_price_usd) > 0
     AND (c.amount_usd/c.linked_plan_price_usd) <= 1
     AND c.any_link AND NOT c.has_neg_link
     AND c.user_id IS NOT NULL
),
all_out AS (
  SELECT p.id AS legacy_transaction_id, p.user_id,
         ROUND(p.amount_usd * 307.55)::int AS amount_fils,
         COALESCE(p.created_at, now()) AS occurred_at,
         'legacy_migration_paypal'::text AS reason,
         'paypal'::text AS gateway,
         'paypal_usd_x_307.55'::text AS policy_note
    FROM pp_verified p
  UNION ALL
  SELECT u.id, u.user_id,
         ROUND(u.base_fils * u.amount_usd / u.linked_plan_price_usd)::int,
         COALESCE(u.created_at, now()),
         'legacy_migration_upayments','upayments','upayments_code_reconstructed_kwd'
    FROM up_verified u
)
SELECT * FROM all_out ORDER BY legacy_transaction_id;
$$;
REVOKE ALL ON FUNCTION private.v2_legacy_credit_plan() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.v2_legacy_credit_plan() FROM anon, authenticated, service_role;

-- Plan hashes ------------------------------------------------------
DROP FUNCTION IF EXISTS private.v2_legacy_plan_hashes();
CREATE FUNCTION private.v2_legacy_plan_hashes()
RETURNS TABLE (entitlement_hash text, credit_hash text, combined_hash text)
LANGUAGE sql STABLE SET search_path TO '' AS $$
WITH
e AS (
  SELECT md5(string_agg(
    COALESCE(user_id::text,'')||'|'||COALESCE(scope::text,'')||'|'||COALESCE(collection_key,'')||'|'||
    COALESCE(grant_reason::text,'')||'|'||
    COALESCE(to_char(granted_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US'),'')||'|'||
    COALESCE(to_char(expires_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US'),'')||'|'||
    COALESCE(legacy_source,'')||'|'||COALESCE(source_tier,'')||'|'||COALESCE(is_lifetime_grant::text,''), E'\n'
  )) AS h FROM (SELECT * FROM private.v2_legacy_entitlement_plan()) x
),
c AS (
  SELECT md5(string_agg(
    COALESCE(legacy_transaction_id::text,'')||'|'||COALESCE(user_id::text,'')||'|'||
    COALESCE(amount_fils::text,'')||'|'||
    COALESCE(to_char(occurred_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US'),'')||'|'||
    COALESCE(reason,'')||'|'||COALESCE(gateway,'')||'|'||COALESCE(policy_note,''), E'\n'
  )) AS h FROM (SELECT * FROM private.v2_legacy_credit_plan()) x
)
SELECT COALESCE(e.h, md5('')), COALESCE(c.h, md5('')),
       md5(COALESCE(e.h,'')||'::'||COALESCE(c.h,''))
  FROM e, c;
$$;
REVOKE ALL ON FUNCTION private.v2_legacy_plan_hashes() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.v2_legacy_plan_hashes() FROM anon, authenticated, service_role;

-- Public admin rehearsal (6B.2-r1) --------------------------------
CREATE OR REPLACE FUNCTION public.v2_admin_migration_rehearsal()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_rate numeric := 307.55;
  v_threshold int := 30000;
  v_result jsonb;
  v_ent_hash text; v_cred_hash text; v_comb_hash text;
BEGIN
  PERFORM public._v2_require_admin();
  SELECT entitlement_hash, credit_hash, combined_hash
    INTO v_ent_hash, v_cred_hash, v_comb_hash FROM private.v2_legacy_plan_hashes();

  WITH
  ent_plan AS (SELECT * FROM private.v2_legacy_entitlement_plan()),
  cred_plan AS (SELECT * FROM private.v2_legacy_credit_plan()),
  ent_agg AS (
    SELECT
      count(*) FILTER (WHERE is_lifetime_grant) AS lifetime_rows,
      count(DISTINCT user_id) FILTER (WHERE is_lifetime_grant) AS lifetime_users,
      count(*) FILTER (WHERE source_tier='premium') AS premium_rows,
      count(*) FILTER (WHERE source_tier='ultimate') AS ultimate_rows,
      count(*) FILTER (WHERE source_tier='standard') AS standard_rows,
      count(DISTINCT user_id) FILTER (WHERE source_tier='standard') AS standard_users,
      count(*) FILTER (WHERE source_tier='basic') AS basic_rows,
      count(DISTINCT user_id) FILTER (WHERE source_tier='basic') AS basic_users,
      count(*) AS total_rows, count(DISTINCT user_id) AS unique_users
    FROM ent_plan
  ),
  cred_agg AS (
    SELECT
      count(*) AS raw_rows,
      count(*) FILTER (WHERE gateway='paypal') AS paypal_rows,
      count(*) FILTER (WHERE gateway='upayments') AS upayments_rows,
      COALESCE(SUM(amount_fils) FILTER (WHERE gateway='paypal'),0)::bigint AS paypal_raw_fils,
      COALESCE(SUM(amount_fils) FILTER (WHERE gateway='upayments'),0)::bigint AS upayments_raw_fils,
      count(DISTINCT user_id) FILTER (WHERE gateway='paypal') AS paypal_users,
      count(DISTINCT user_id) FILTER (WHERE gateway='upayments') AS upayments_users
    FROM cred_plan
  ),
  per_user_raw AS (
    SELECT user_id,
      COALESCE(SUM(amount_fils) FILTER (WHERE gateway='paypal'),0)::bigint AS pp_raw,
      COALESCE(SUM(amount_fils) FILTER (WHERE gateway='upayments'),0)::bigint AS up_raw,
      COALESCE(SUM(amount_fils),0)::bigint AS all_raw
    FROM cred_plan GROUP BY user_id
  ),
  per_user_cap AS (
    SELECT user_id,
      LEAST(pp_raw,  v_threshold)::bigint AS pp_cap,
      LEAST(up_raw,  v_threshold)::bigint AS up_cap,
      LEAST(all_raw, v_threshold)::bigint AS combined_cap
    FROM per_user_raw
  ),
  cap_agg AS (
    SELECT
      COALESCE(SUM(pp_cap),0)::bigint AS paypal_capped_fils,
      COALESCE(SUM(up_cap),0)::bigint AS upayments_capped_fils,
      COALESCE(SUM(combined_cap),0)::bigint AS combined_capped_fils,
      count(*) FILTER (WHERE combined_cap > 0) AS combined_users,
      count(*) FILTER (WHERE combined_cap >= v_threshold) AS users_reaching_threshold
    FROM per_user_cap
  ),
  lifetime_user_set AS (SELECT DISTINCT user_id FROM ent_plan WHERE is_lifetime_grant),
  threshold_needing AS (
    SELECT count(*)::int AS n FROM per_user_cap pc
     WHERE pc.combined_cap >= v_threshold
       AND pc.user_id NOT IN (SELECT user_id FROM lifetime_user_set)
  ),
  existing_ent_all AS (
    SELECT count(*)::int AS n FROM public.entitlements WHERE legacy_source IS NOT NULL
  ),
  existing_credit_all AS (
    SELECT count(*)::int AS n FROM public.lifetime_credit_entries WHERE legacy_transaction_id IS NOT NULL
  ),
  s AS (
    SELECT us.user_id,
           lower(COALESCE(pl.tier,'')) AS tier,
           COALESCE(pl.is_lifetime,false) AS is_lifetime,
           lower(COALESCE(us.status,'')) AS status,
           us.end_date
      FROM public.user_subscriptions us
      LEFT JOIN public.subscription_plans pl ON pl.id=us.plan_id
     WHERE us.user_id IS NOT NULL
  ),
  cancelled_lifetime_unresolved AS (
    SELECT count(DISTINCT s.user_id)::int AS n FROM s
     WHERE s.is_lifetime
       AND s.status IN ('cancelled','canceled','refunded','revoked','chargeback','charged_back')
       AND s.user_id NOT IN (SELECT user_id FROM lifetime_user_set)
  ),
  positive AS (SELECT * FROM s WHERE status IN ('active','completed','paid','succeeded')),
  basic_hist_only AS (
    SELECT count(DISTINCT user_id)::int AS n FROM positive
     WHERE NOT is_lifetime AND tier='basic' AND end_date IS NOT NULL AND end_date < now()
       AND user_id NOT IN (SELECT user_id FROM lifetime_user_set)
       AND user_id NOT IN (SELECT DISTINCT user_id FROM ent_plan WHERE source_tier='standard')
       AND user_id NOT IN (SELECT DISTINCT user_id FROM ent_plan WHERE source_tier='basic')
  ),
  standard_hist_only AS (
    SELECT count(DISTINCT user_id)::int AS n FROM positive
     WHERE NOT is_lifetime AND tier='standard' AND end_date IS NOT NULL AND end_date < now()
       AND user_id NOT IN (SELECT user_id FROM lifetime_user_set)
       AND user_id NOT IN (SELECT DISTINCT user_id FROM ent_plan WHERE source_tier='standard')
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'execute_available', false,
    'execution_requires_database_approval', true,
    'private_executor_ready', true,
    'confirmation_phrase_required', 'EXECUTE_JOJOPROMPTS_V2_LEGACY_6B_2_R1',
    'notes', 'Read-only rehearsal aggregating from private.v2_legacy_entitlement_plan / v2_legacy_credit_plan. No public execute RPC exists.',
    'policy_version', '6B.2-r1',
    'conversion_rate_fils_per_usd', v_rate,
    'threshold_fils', v_threshold,
    'entitlement_plan_hash', v_ent_hash,
    'credit_plan_hash', v_cred_hash,
    'combined_plan_hash', v_comb_hash,
    'planned_writes', jsonb_build_object(
      'entitlement_rows_total', (SELECT total_rows FROM ent_agg),
      'entitlement_unique_users', (SELECT unique_users FROM ent_agg),
      'entitlement_lifetime_rows', (SELECT lifetime_rows FROM ent_agg),
      'entitlement_lifetime_users', (SELECT lifetime_users FROM ent_agg),
      'entitlement_premium_rows', (SELECT premium_rows FROM ent_agg),
      'entitlement_ultimate_rows', (SELECT ultimate_rows FROM ent_agg),
      'entitlement_standard_users', (SELECT standard_users FROM ent_agg),
      'entitlement_standard_grants', (SELECT standard_rows FROM ent_agg),
      'entitlement_basic_users', (SELECT basic_users FROM ent_agg),
      'entitlement_basic_grants', (SELECT basic_rows FROM ent_agg),
      'credit_rows_total', (SELECT raw_rows FROM cred_agg),
      'credit_paypal_rows', (SELECT paypal_rows FROM cred_agg),
      'credit_upayments_rows', (SELECT upayments_rows FROM cred_agg),
      'credit_paypal_users', (SELECT paypal_users FROM cred_agg),
      'credit_upayments_users', (SELECT upayments_users FROM cred_agg)
    ),
    'existing_writes', jsonb_build_object(
      'entitlements_with_legacy_source', (SELECT n FROM existing_ent_all),
      'credit_entries_with_legacy_transaction_id', (SELECT n FROM existing_credit_all)
    ),
    'pending_writes', jsonb_build_object(
      'entitlements_to_insert', GREATEST((SELECT total_rows FROM ent_agg) - (SELECT n FROM existing_ent_all),0),
      'credit_entries_to_insert', GREATEST((SELECT raw_rows FROM cred_agg) - (SELECT n FROM existing_credit_all),0),
      'threshold_lifetime_grants_needed_now', (SELECT n FROM threshold_needing)
    ),
    'credit_totals', jsonb_build_object(
      'paypal_raw_fils', (SELECT paypal_raw_fils FROM cred_agg),
      'paypal_capped_fils', (SELECT paypal_capped_fils FROM cap_agg),
      'upayments_raw_fils', (SELECT upayments_raw_fils FROM cred_agg),
      'upayments_capped_fils', (SELECT upayments_capped_fils FROM cap_agg),
      'combined_capped_fils', (SELECT combined_capped_fils FROM cap_agg),
      'combined_users', (SELECT combined_users FROM cap_agg),
      'users_reaching_threshold', (SELECT users_reaching_threshold FROM cap_agg)
    ),
    'cohorts', jsonb_build_object(
      'historical_expired_basic_users', (SELECT n FROM basic_hist_only),
      'historical_expired_standard_users', (SELECT n FROM standard_hist_only),
      'cancelled_lifetime_unresolved_users', (SELECT n FROM cancelled_lifetime_unresolved)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.v2_admin_migration_rehearsal() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.v2_admin_migration_rehearsal() FROM anon;
GRANT  EXECUTE ON FUNCTION public.v2_admin_migration_rehearsal() TO authenticated;
GRANT  EXECUTE ON FUNCTION public.v2_admin_migration_rehearsal() TO service_role;

-- Private executor -------------------------------------------------
DROP FUNCTION IF EXISTS private.execute_v2_legacy_migration(text, text);
CREATE FUNCTION private.execute_v2_legacy_migration(
  p_confirmation text,
  p_expected_plan_hash text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_expected_confirm text := 'EXECUTE_JOJOPROMPTS_V2_LEGACY_6B_2_R1';
  v_ent_hash text; v_cred_hash text; v_comb_hash text;
  v_planned_ent_rows int; v_planned_ent_users int;
  v_planned_lifetime_rows int; v_planned_standard_grants int; v_planned_basic_grants int;
  v_planned_cancelled_unresolved int; v_planned_credit_rows int; v_planned_threshold_needing int;
  v_pre_existing_ent int; v_pre_existing_credit int; v_pre_existing_threshold int;
  v_inserted_ent int := 0; v_inserted_credit int := 0; v_inserted_threshold int := 0;
  v_post_ent_total int; v_post_credit_total int; v_post_threshold_total int;
  v_audit_id uuid := NULL; v_actor uuid := NULL;
  v_threshold int := 30000;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('v2:legacy_migration_6B_2_r1', 0));

  IF p_confirmation IS DISTINCT FROM v_expected_confirm THEN
    RAISE EXCEPTION 'invalid_confirmation_phrase' USING ERRCODE='22023';
  END IF;

  SELECT entitlement_hash, credit_hash, combined_hash
    INTO v_ent_hash, v_cred_hash, v_comb_hash FROM private.v2_legacy_plan_hashes();
  IF p_expected_plan_hash IS NULL OR p_expected_plan_hash <> v_comb_hash THEN
    RAISE EXCEPTION 'plan_hash_mismatch: expected=% actual=%',
      COALESCE(p_expected_plan_hash,'<null>'), v_comb_hash USING ERRCODE='22023';
  END IF;

  SELECT count(*), count(DISTINCT user_id),
         count(*) FILTER (WHERE is_lifetime_grant),
         count(*) FILTER (WHERE source_tier='standard'),
         count(*) FILTER (WHERE source_tier='basic')
    INTO v_planned_ent_rows, v_planned_ent_users, v_planned_lifetime_rows,
         v_planned_standard_grants, v_planned_basic_grants
    FROM private.v2_legacy_entitlement_plan();

  SELECT count(*) INTO v_planned_credit_rows FROM private.v2_legacy_credit_plan();

  WITH s AS (
    SELECT us.user_id,
           COALESCE(pl.is_lifetime,false) AS is_lifetime,
           lower(COALESCE(us.status,'')) AS status
      FROM public.user_subscriptions us
      LEFT JOIN public.subscription_plans pl ON pl.id=us.plan_id
     WHERE us.user_id IS NOT NULL
  ),
  lu AS (SELECT DISTINCT user_id FROM private.v2_legacy_entitlement_plan() WHERE is_lifetime_grant)
  SELECT count(DISTINCT s.user_id)::int
    INTO v_planned_cancelled_unresolved
    FROM s WHERE s.is_lifetime
       AND s.status IN ('cancelled','canceled','refunded','revoked','chargeback','charged_back')
       AND s.user_id NOT IN (SELECT user_id FROM lu);

  WITH per_user AS (
    SELECT user_id, LEAST(COALESCE(SUM(amount_fils),0), v_threshold)::bigint AS combined_cap
      FROM private.v2_legacy_credit_plan() GROUP BY user_id
  ),
  lu AS (SELECT DISTINCT user_id FROM private.v2_legacy_entitlement_plan() WHERE is_lifetime_grant)
  SELECT count(*)::int INTO v_planned_threshold_needing
    FROM per_user
   WHERE combined_cap >= v_threshold
     AND user_id NOT IN (SELECT user_id FROM lu);

  SELECT count(*)::int INTO v_pre_existing_ent
    FROM public.entitlements WHERE legacy_source IS NOT NULL;
  SELECT count(*)::int INTO v_pre_existing_credit
    FROM public.lifetime_credit_entries WHERE legacy_transaction_id IS NOT NULL;
  SELECT count(*)::int INTO v_pre_existing_threshold
    FROM public.entitlements
   WHERE grant_reason='lifetime_threshold'::public.v2_grant_reason
     AND scope='library'::public.v2_entitlement_scope
     AND revoked_at IS NULL;

  IF v_pre_existing_ent = 0 AND v_pre_existing_credit = 0 THEN
    IF v_planned_ent_rows <> 116 THEN RAISE EXCEPTION 'plan_total_mismatch_entitlements: expected 116 got %', v_planned_ent_rows USING ERRCODE='22023'; END IF;
    IF v_planned_credit_rows <> 56 THEN RAISE EXCEPTION 'plan_total_mismatch_credits: expected 56 got %', v_planned_credit_rows USING ERRCODE='22023'; END IF;
    IF v_planned_lifetime_rows <> 74 THEN RAISE EXCEPTION 'plan_total_mismatch_lifetime: expected 74 got %', v_planned_lifetime_rows USING ERRCODE='22023'; END IF;
    IF v_planned_standard_grants <> 40 THEN RAISE EXCEPTION 'plan_total_mismatch_standard: expected 40 got %', v_planned_standard_grants USING ERRCODE='22023'; END IF;
    IF v_planned_basic_grants <> 2 THEN RAISE EXCEPTION 'plan_total_mismatch_basic: expected 2 got %', v_planned_basic_grants USING ERRCODE='22023'; END IF;
    IF v_planned_cancelled_unresolved <> 1 THEN RAISE EXCEPTION 'plan_total_mismatch_cancelled_unresolved: expected 1 got %', v_planned_cancelled_unresolved USING ERRCODE='22023'; END IF;
    IF v_planned_threshold_needing <> 0 THEN RAISE EXCEPTION 'plan_total_mismatch_threshold_needing: expected 0 got %', v_planned_threshold_needing USING ERRCODE='22023'; END IF;
  END IF;

  BEGIN v_actor := auth.uid(); EXCEPTION WHEN OTHERS THEN v_actor := NULL; END;

  WITH plan AS (SELECT * FROM private.v2_legacy_entitlement_plan()),
  to_insert AS (
    SELECT p.* FROM plan p
     WHERE NOT EXISTS (
       SELECT 1 FROM public.entitlements e
        WHERE e.legacy_source IS NOT NULL
          AND e.user_id = p.user_id
          AND e.legacy_source = p.legacy_source
          AND e.scope = p.scope
          AND COALESCE(e.collection_key,'') = COALESCE(p.collection_key,'')
          AND COALESCE(e.resource_id, '00000000-0000-0000-0000-000000000000'::uuid)
              = '00000000-0000-0000-0000-000000000000'::uuid
     )
  ),
  inserted AS (
    INSERT INTO public.entitlements
      (user_id, resource_id, grant_reason, scope, collection_key,
       granted_at, expires_at, legacy_source, version_major)
    SELECT ti.user_id, NULL::uuid, ti.grant_reason, ti.scope, ti.collection_key,
           ti.granted_at, ti.expires_at, ti.legacy_source, NULL::int
      FROM to_insert ti
    RETURNING 1
  )
  SELECT count(*)::int INTO v_inserted_ent FROM inserted;

  WITH plan AS (SELECT * FROM private.v2_legacy_credit_plan()),
  to_insert AS (
    SELECT p.* FROM plan p
     WHERE NOT EXISTS (SELECT 1 FROM public.lifetime_credit_entries l
                        WHERE l.legacy_transaction_id = p.legacy_transaction_id)
  ),
  inserted AS (
    INSERT INTO public.lifetime_credit_entries
      (user_id, order_id, refund_id, amount_fils, reason, occurred_at, legacy_transaction_id)
    SELECT ti.user_id, NULL::uuid, NULL::uuid, ti.amount_fils, ti.reason, ti.occurred_at, ti.legacy_transaction_id
      FROM to_insert ti
    RETURNING 1
  )
  SELECT count(*)::int INTO v_inserted_credit FROM inserted;

  WITH per_user AS (
    SELECT user_id,
           LEAST(GREATEST(COALESCE(SUM(amount_fils),0),0), v_threshold)::bigint AS combined_cap
      FROM public.lifetime_credit_entries GROUP BY user_id
  ),
  needing AS (
    SELECT pu.user_id FROM per_user pu
     WHERE pu.combined_cap >= v_threshold
       AND NOT EXISTS (
         SELECT 1 FROM public.entitlements e
          WHERE e.user_id = pu.user_id
            AND e.scope = 'library'::public.v2_entitlement_scope
            AND e.revoked_at IS NULL
            AND (e.expires_at IS NULL OR e.expires_at > now())
       )
  ),
  inserted AS (
    INSERT INTO public.entitlements
      (user_id, resource_id, grant_reason, scope, collection_key,
       granted_at, expires_at, legacy_source, version_major)
    SELECT n.user_id, NULL::uuid,
           'lifetime_threshold'::public.v2_grant_reason,
           'library'::public.v2_entitlement_scope,
           NULL::text, now(), NULL::timestamptz,
           'threshold:legacy_credit_6B_2_r1', NULL::int
      FROM needing n
    RETURNING 1
  )
  SELECT count(*)::int INTO v_inserted_threshold FROM inserted;

  IF v_pre_existing_ent = 0 AND v_pre_existing_credit = 0 AND v_inserted_threshold <> 0 THEN
    RAISE EXCEPTION 'unexpected_threshold_inserts_first_run: %', v_inserted_threshold USING ERRCODE='22023';
  END IF;

  SELECT count(*)::int INTO v_post_ent_total
    FROM public.entitlements WHERE legacy_source IS NOT NULL;
  SELECT count(*)::int INTO v_post_credit_total
    FROM public.lifetime_credit_entries WHERE legacy_transaction_id IS NOT NULL;
  SELECT count(*)::int INTO v_post_threshold_total
    FROM public.entitlements
   WHERE grant_reason='lifetime_threshold'::public.v2_grant_reason
     AND scope='library'::public.v2_entitlement_scope
     AND revoked_at IS NULL;

  IF (v_inserted_ent + v_inserted_credit + v_inserted_threshold) > 0 THEN
    INSERT INTO public.activity_events
      (actor_user_id, actor_type, entity_type, entity_id, action, metadata)
    VALUES
      (v_actor, CASE WHEN v_actor IS NULL THEN 'system' ELSE 'admin' END,
       'legacy_migration', NULL, 'v2_legacy_migration_executed',
       jsonb_build_object(
         'policy_version','6B.2-r1',
         'entitlement_plan_hash', v_ent_hash,
         'credit_plan_hash', v_cred_hash,
         'combined_plan_hash', v_comb_hash,
         'inserted_entitlements', v_inserted_ent,
         'inserted_credit_entries', v_inserted_credit,
         'inserted_threshold_grants', v_inserted_threshold,
         'planned_entitlement_rows', v_planned_ent_rows,
         'planned_credit_rows', v_planned_credit_rows
       ))
    RETURNING id INTO v_audit_id;
  END IF;

  RETURN jsonb_build_object(
    'policy_version','6B.2-r1',
    'confirmation_phrase_accepted', true,
    'entitlement_plan_hash', v_ent_hash,
    'credit_plan_hash', v_cred_hash,
    'combined_plan_hash', v_comb_hash,
    'planned', jsonb_build_object(
      'entitlement_rows', v_planned_ent_rows,
      'entitlement_users', v_planned_ent_users,
      'entitlement_lifetime_rows', v_planned_lifetime_rows,
      'entitlement_standard_grants', v_planned_standard_grants,
      'entitlement_basic_grants', v_planned_basic_grants,
      'credit_rows', v_planned_credit_rows,
      'threshold_needing_before', v_planned_threshold_needing,
      'cancelled_lifetime_unresolved', v_planned_cancelled_unresolved
    ),
    'pre_existing', jsonb_build_object(
      'entitlements_with_legacy_source', v_pre_existing_ent,
      'credit_entries_with_legacy_transaction_id', v_pre_existing_credit,
      'active_lifetime_threshold_entitlements', v_pre_existing_threshold
    ),
    'inserted', jsonb_build_object(
      'entitlements', v_inserted_ent,
      'credit_entries', v_inserted_credit,
      'threshold_grants', v_inserted_threshold
    ),
    'post_state', jsonb_build_object(
      'entitlements_with_legacy_source', v_post_ent_total,
      'credit_entries_with_legacy_transaction_id', v_post_credit_total,
      'active_lifetime_threshold_entitlements', v_post_threshold_total
    ),
    'audit_event_id', v_audit_id
  );
END;
$function$;
REVOKE ALL ON FUNCTION private.execute_v2_legacy_migration(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.execute_v2_legacy_migration(text, text) FROM anon, authenticated, service_role;

COMMENT ON FUNCTION private.execute_v2_legacy_migration(text, text) IS
  'Phase 6B.2 one-time legacy migration executor. Owner/postgres only. Never exposed via PostgREST.';
COMMENT ON FUNCTION private.v2_legacy_entitlement_plan() IS
  'Deterministic planned legacy-migration entitlement grants (policy 6B.2-r1).';
COMMENT ON FUNCTION private.v2_legacy_credit_plan() IS
  'Deterministic planned legacy-migration credit ledger rows (raw, uncapped).';
