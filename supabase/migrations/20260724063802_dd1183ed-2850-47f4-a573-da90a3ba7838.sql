
-- =============================================================================
-- Phase 6B.1 corrective pass (forward-only). No data mutation. No exec RPC.
-- =============================================================================

-- 1) Admin migration preview — strict verified PayPal credit + cohort clarity.
CREATE OR REPLACE FUNCTION public.v2_admin_migration_preview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_rate         numeric := 307.55;
  v_threshold    int     := 30000;
  v_catalog      jsonb;
  v_collections  jsonb;
  v_unmatched    jsonb;
  v_subs         jsonb;
  v_plan_cohorts jsonb;
  v_tx_paypal    jsonb;
  v_tx_upay      jsonb;
  v_ents         jsonb;
  v_credits      jsonb;
  v_anomalies    jsonb;
  v_contract     jsonb;
  v_policy       jsonb;
  v_legacy_plans jsonb;
  v_blockers     text[] := ARRAY[]::text[];
BEGIN
  PERFORM public._v2_require_admin();

  -- Catalog reconciliation (unchanged)
  WITH prompts_c AS (SELECT count(*) AS c FROM public.prompts),
       matched AS (SELECT count(*) AS c FROM public.resources WHERE legacy_prompt_id IS NOT NULL),
       versions_c AS (
         SELECT count(*) AS c FROM public.resource_versions rv
          JOIN public.resources r ON r.id = rv.resource_id
         WHERE r.legacy_prompt_id IS NOT NULL
       ),
       products_c AS (
         SELECT count(*) AS c FROM public.products p
          JOIN public.resources r ON r.id = p.resource_id
         WHERE r.legacy_prompt_id IS NOT NULL
       ),
       unmatched_prompts AS (
         SELECT count(*) AS c FROM public.prompts p
         WHERE NOT EXISTS (SELECT 1 FROM public.resources r WHERE r.legacy_prompt_id = p.id)
       )
  SELECT jsonb_build_object(
    'legacy_prompt_count',           (SELECT c FROM prompts_c),
    'matched_resource_count',        (SELECT c FROM matched),
    'legacy_version_count',          (SELECT c FROM versions_c),
    'legacy_product_count',          (SELECT c FROM products_c),
    'unmatched_legacy_prompt_count', (SELECT c FROM unmatched_prompts)
  ) INTO v_catalog;

  WITH classified AS (
    SELECT r.id, public.v2_resource_collection_key(r.id) AS ck
      FROM public.resources r
     WHERE r.legacy_prompt_id IS NOT NULL
  )
  SELECT jsonb_build_object(
    'chatgpt_prompts',       count(*) FILTER (WHERE ck='chatgpt_prompts'),
    'midjourney_prompts',    count(*) FILTER (WHERE ck='midjourney_prompts'),
    'unmatched_or_ambiguous',count(*) FILTER (WHERE ck IS NULL)
  ) INTO v_collections FROM classified;

  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb) INTO v_unmatched
  FROM (
    SELECT r.id::text AS resource_id, r.type::text AS resource_type,
           r.slug, p.prompt_type AS legacy_prompt_type
      FROM public.resources r
      LEFT JOIN public.prompts p ON p.id = r.legacy_prompt_id
     WHERE r.legacy_prompt_id IS NOT NULL
       AND public.v2_resource_collection_key(r.id) IS NULL
     ORDER BY r.created_at ASC
     LIMIT 25
  ) x;

  -- Sub rollup + cohorts (unchanged shape, expanded with source-row/unresolved-user clarity)
  WITH sub_rollup AS (
    SELECT
      lower(COALESCE(pl.tier,'unknown')) AS tier,
      COALESCE(pl.is_lifetime,false)     AS is_lifetime,
      lower(COALESCE(us.status,''))      AS status,
      count(*) AS n,
      count(*) FILTER (WHERE us.end_date IS NOT NULL AND us.end_date < now()) AS expired_n,
      count(*) FILTER (WHERE us.end_date IS NULL OR us.end_date >= now())     AS active_n
    FROM public.user_subscriptions us
    LEFT JOIN public.subscription_plans pl ON pl.id = us.plan_id
    GROUP BY 1,2,3
  )
  SELECT jsonb_build_object(
    'rows', COALESCE(jsonb_agg(jsonb_build_object(
      'tier', tier,
      'is_lifetime', is_lifetime,
      'status', status,
      'count', n,
      'expired', expired_n,
      'active_or_perpetual', active_n,
      'proposed_scope',
        CASE
          WHEN is_lifetime AND status IN ('active','completed','paid','succeeded') THEN 'library'
          WHEN is_lifetime AND status NOT IN ('active','completed','paid','succeeded') THEN 'no_grant_review'
          WHEN tier IN ('basic','standard') AND status IN ('active','completed','paid','succeeded') THEN 'collection'
          ELSE 'none'
        END
    )), '[]'::jsonb),
    'total_subscriptions', (SELECT count(*) FROM public.user_subscriptions),
    'distinct_users',      (SELECT count(DISTINCT user_id) FROM public.user_subscriptions)
  ) INTO v_subs FROM sub_rollup;

  WITH s AS (
    SELECT us.user_id,
           lower(COALESCE(pl.tier,'unknown'))     AS tier,
           COALESCE(pl.is_lifetime,false)          AS is_lifetime,
           lower(COALESCE(us.status,''))           AS status,
           us.start_date, us.end_date
      FROM public.user_subscriptions us
      LEFT JOIN public.subscription_plans pl ON pl.id = us.plan_id
     WHERE us.user_id IS NOT NULL
  ),
  positive_status AS (
    SELECT * FROM s WHERE status IN ('active','completed','paid','succeeded')
  ),
  -- Active lifetime requires a non-past end_date too (or NULL).
  lifetime_active AS (
    SELECT DISTINCT user_id, tier FROM positive_status
     WHERE is_lifetime AND (end_date IS NULL OR end_date >= now())
  ),
  premium_active AS (SELECT DISTINCT user_id FROM lifetime_active WHERE tier='premium'),
  ultimate_active AS (SELECT DISTINCT user_id FROM lifetime_active WHERE tier='ultimate'),
  lifetime_active_users AS (
    SELECT user_id FROM premium_active UNION SELECT user_id FROM ultimate_active
  ),
  ultimate_cancelled_raw AS (
    SELECT * FROM s WHERE is_lifetime AND tier='ultimate'
       AND status NOT IN ('active','completed','paid','succeeded')
  ),
  premium_cancelled_raw AS (
    SELECT * FROM s WHERE is_lifetime AND tier='premium'
       AND status NOT IN ('active','completed','paid','succeeded')
  ),
  -- "Unresolved" = user is not already covered by a valid active lifetime record.
  ultimate_cancelled_unresolved AS (
    SELECT DISTINCT user_id FROM ultimate_cancelled_raw
     WHERE user_id NOT IN (SELECT user_id FROM lifetime_active_users)
  ),
  premium_cancelled_unresolved AS (
    SELECT DISTINCT user_id FROM premium_cancelled_raw
     WHERE user_id NOT IN (SELECT user_id FROM lifetime_active_users)
  ),
  basic_active AS (
    SELECT DISTINCT user_id FROM positive_status
     WHERE NOT is_lifetime AND tier = 'basic'
       AND (end_date IS NULL OR end_date >= now())
       AND user_id NOT IN (SELECT user_id FROM lifetime_active_users)
  ),
  standard_active AS (
    SELECT DISTINCT user_id FROM positive_status
     WHERE NOT is_lifetime AND tier = 'standard'
       AND (end_date IS NULL OR end_date >= now())
       AND user_id NOT IN (SELECT user_id FROM lifetime_active_users)
  ),
  basic_expired AS (
    SELECT DISTINCT user_id FROM positive_status
     WHERE NOT is_lifetime AND tier = 'basic'
       AND end_date IS NOT NULL AND end_date < now()
       AND user_id NOT IN (SELECT user_id FROM basic_active)
       AND user_id NOT IN (SELECT user_id FROM standard_active)
       AND user_id NOT IN (SELECT user_id FROM lifetime_active_users)
  ),
  standard_expired AS (
    SELECT DISTINCT user_id FROM positive_status
     WHERE NOT is_lifetime AND tier = 'standard'
       AND end_date IS NOT NULL AND end_date < now()
       AND user_id NOT IN (SELECT user_id FROM standard_active)
       AND user_id NOT IN (SELECT user_id FROM lifetime_active_users)
  ),
  basic_cancelled_raw AS (
    SELECT * FROM s WHERE NOT is_lifetime AND tier='basic'
       AND status NOT IN ('active','completed','paid','succeeded')
  ),
  standard_cancelled_raw AS (
    SELECT * FROM s WHERE NOT is_lifetime AND tier='standard'
       AND status NOT IN ('active','completed','paid','succeeded')
  ),
  basic_cancelled_unresolved AS (
    SELECT DISTINCT user_id FROM basic_cancelled_raw
     WHERE user_id NOT IN (SELECT user_id FROM lifetime_active_users)
       AND user_id NOT IN (SELECT user_id FROM basic_active)
       AND user_id NOT IN (SELECT user_id FROM standard_active)
  ),
  standard_cancelled_unresolved AS (
    SELECT DISTINCT user_id FROM standard_cancelled_raw
     WHERE user_id NOT IN (SELECT user_id FROM lifetime_active_users)
       AND user_id NOT IN (SELECT user_id FROM standard_active)
  )
  SELECT jsonb_build_object(
    'ultimate_active_lifetime_users',      (SELECT count(*) FROM ultimate_active),
    'premium_active_lifetime_users',       (SELECT count(*) FROM premium_active),
    -- Raw source-row counts for admin visibility
    'ultimate_cancelled_source_rows',      (SELECT count(*) FROM ultimate_cancelled_raw),
    'premium_cancelled_source_rows',       (SELECT count(*) FROM premium_cancelled_raw),
    'basic_cancelled_source_rows',         (SELECT count(*) FROM basic_cancelled_raw),
    'standard_cancelled_source_rows',      (SELECT count(*) FROM standard_cancelled_raw),
    -- Deduplicated unresolved users (after removing users with a valid active superseding record)
    'ultimate_cancelled_unresolved_users', (SELECT count(*) FROM ultimate_cancelled_unresolved),
    'premium_cancelled_unresolved_users',  (SELECT count(*) FROM premium_cancelled_unresolved),
    'basic_cancelled_unresolved_users',    (SELECT count(*) FROM basic_cancelled_unresolved),
    'standard_cancelled_unresolved_users', (SELECT count(*) FROM standard_cancelled_unresolved),
    -- Legacy field names kept for back-compat (mapped to unresolved deduped counts)
    'ultimate_cancelled_review_users',     (SELECT count(*) FROM ultimate_cancelled_unresolved),
    'premium_cancelled_review_users',      (SELECT count(*) FROM premium_cancelled_unresolved),
    'basic_cancelled_review_users',        (SELECT count(*) FROM basic_cancelled_unresolved),
    'standard_cancelled_review_users',     (SELECT count(*) FROM standard_cancelled_unresolved),
    'basic_active_users',                  (SELECT count(*) FROM basic_active),
    'standard_active_users',               (SELECT count(*) FROM standard_active),
    'basic_expired_historical_users',      (SELECT count(*) FROM basic_expired),
    'standard_expired_historical_users',   (SELECT count(*) FROM standard_expired),
    'raw_row_counts_by_tier_status', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'tier', tier, 'is_lifetime', is_lifetime, 'status', status, 'rows', n))
        FROM (
          SELECT tier, is_lifetime, status, count(*) AS n
            FROM s GROUP BY 1,2,3 ORDER BY 1,2,3
        ) z
    ), '[]'::jsonb)
  ) INTO v_plan_cohorts;

  -- === PayPal: strict verified credit ===
  WITH pp AS (
    SELECT t.*
      FROM public.transactions t
     WHERE lower(COALESCE(t.payment_gateway,'')) = 'paypal'
  ),
  pp_pos AS (
    SELECT * FROM pp
     WHERE lower(COALESCE(status,'')) IN ('completed','captured','success','paid')
       AND COALESCE(amount_usd,0) > 0
  ),
  pp_class AS (
    SELECT p.*,
      EXISTS (SELECT 1 FROM public.user_subscriptions us
               WHERE us.transaction_id = p.id
                 AND lower(COALESCE(us.status,'')) IN ('active','completed','paid','succeeded')) AS has_pos_link,
      EXISTS (SELECT 1 FROM public.user_subscriptions us
               WHERE us.transaction_id = p.id
                 AND lower(COALESCE(us.status,'')) IN ('cancelled','canceled','refunded','revoked','chargeback','charged_back')) AS has_neg_link,
      EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.transaction_id = p.id) AS any_link
      FROM pp_pos p
  ),
  pp_verified AS (SELECT * FROM pp_class WHERE has_pos_link AND NOT has_neg_link),
  pp_unlinked_review AS (SELECT * FROM pp_class WHERE NOT any_link),
  pp_neg_review AS (SELECT * FROM pp_class WHERE has_neg_link),
  by_status AS (
    SELECT status, count(*) AS n,
           SUM(COALESCE(amount_usd,0))::numeric(20,2) AS usd_total,
           SUM(ROUND(COALESCE(amount_usd,0) * v_rate))::bigint AS fils_total
      FROM pp GROUP BY status
  ),
  per_user_verified AS (
    SELECT user_id,
           LEAST(SUM(ROUND(COALESCE(amount_usd,0) * v_rate))::bigint, v_threshold)::bigint AS credit_fils
      FROM pp_verified WHERE user_id IS NOT NULL
     GROUP BY user_id
  )
  SELECT jsonb_build_object(
    'classification', 'strict verified: paypal + completed/captured/success/paid + amount_usd>0 + has positive-status linked subscription + no negative-status linked subscription',
    'conversion_rate_fils_per_usd', v_rate,
    'rounding', 'ROUND(amount_usd * 307.55) fils per row',
    'per_user_cap_fils', v_threshold,
    'total_count', (SELECT count(*) FROM pp),
    'by_status', COALESCE((SELECT jsonb_agg(row_to_json(bs)) FROM by_status bs), '[]'::jsonb),
    'positive_completed_rows',       (SELECT count(*) FROM pp_pos),
    'verified_rows',                 (SELECT count(*) FROM pp_verified),
    'unlinked_positive_review_rows', (SELECT count(*) FROM pp_unlinked_review),
    'negative_linked_review_rows',   (SELECT count(*) FROM pp_neg_review),
    'verified_users',                COALESCE((SELECT count(*) FROM per_user_verified WHERE credit_fils > 0),0),
    'verified_total_capped_fils',    COALESCE((SELECT SUM(credit_fils)::bigint FROM per_user_verified),0),
    'verified_users_capped_at_threshold', COALESCE((SELECT count(*) FROM per_user_verified WHERE credit_fils >= v_threshold),0),
    -- Kept for back-compat but now reflects strict verified pre-cap total.
    'proposed_credit_fils_completed_precap', COALESCE((
      SELECT SUM(ROUND(COALESCE(amount_usd,0) * v_rate))::bigint FROM pp_verified
    ), 0),
    'zero_amount_count', (SELECT count(*) FROM pp WHERE COALESCE(amount_usd,0) = 0),
    'missing_subscription_link', (SELECT count(*) FROM pp_unlinked_review),
    'duplicate_provider_reference_groups', (
      SELECT count(*) FROM (
        SELECT COALESCE(paypal_order_id, paypal_payment_id) AS ref
          FROM pp WHERE COALESCE(paypal_order_id, paypal_payment_id) IS NOT NULL
         GROUP BY 1 HAVING count(*) > 1
      ) d
    )
  ) INTO v_tx_paypal;

  -- === UPayments (unchanged interpretations; PayPal baseline uses strict verified) ===
  WITH up AS (
    SELECT t.*
      FROM public.transactions t
     WHERE lower(COALESCE(t.payment_gateway,'')) = 'upayments'
        OR t.upayments_invoice_id IS NOT NULL
        OR t.upayments_track_id IS NOT NULL
  ),
  up_completed AS (
    SELECT * FROM up WHERE status IN ('completed','captured','success','paid')
  ),
  totals AS (
    SELECT
      count(*) AS n,
      (SELECT count(*) FROM up_completed) AS completed_n,
      SUM(COALESCE(amount_usd,0))::numeric(20,3) AS raw_value_total
      FROM up
  ),
  -- Strict verified PayPal baseline (same rules as v_tx_paypal.per_user_verified)
  pp_pos AS (
    SELECT t.* FROM public.transactions t
     WHERE lower(COALESCE(t.payment_gateway,'')) = 'paypal'
       AND lower(COALESCE(t.status,'')) IN ('completed','captured','success','paid')
       AND COALESCE(t.amount_usd,0) > 0
  ),
  pp_verified AS (
    SELECT p.* FROM pp_pos p
     WHERE EXISTS (SELECT 1 FROM public.user_subscriptions us
                    WHERE us.transaction_id = p.id
                      AND lower(COALESCE(us.status,'')) IN ('active','completed','paid','succeeded'))
       AND NOT EXISTS (SELECT 1 FROM public.user_subscriptions us
                    WHERE us.transaction_id = p.id
                      AND lower(COALESCE(us.status,'')) IN ('cancelled','canceled','refunded','revoked','chargeback','charged_back'))
  ),
  per_user_pp AS (
    SELECT user_id,
           LEAST(SUM(ROUND(COALESCE(amount_usd,0) * v_rate))::bigint, v_threshold)::bigint AS credit_fils
      FROM pp_verified WHERE user_id IS NOT NULL
     GROUP BY user_id
  ),
  per_user_upay_kwd AS (
    SELECT t.user_id,
           LEAST(SUM(ROUND(COALESCE(t.amount_usd,0) * 1000))::bigint, v_threshold)::bigint AS credit_fils
      FROM up_completed t
     WHERE t.user_id IS NOT NULL AND COALESCE(t.amount_usd,0) > 0
     GROUP BY t.user_id
  ),
  per_user_upay_usd AS (
    SELECT t.user_id,
           LEAST(SUM(ROUND(COALESCE(t.amount_usd,0) * v_rate))::bigint, v_threshold)::bigint AS credit_fils
      FROM up_completed t
     WHERE t.user_id IS NOT NULL AND COALESCE(t.amount_usd,0) > 0
     GROUP BY t.user_id
  ),
  combined_kwd AS (
    SELECT COALESCE(a.user_id, b.user_id) AS user_id,
           LEAST(COALESCE(a.credit_fils,0) + COALESCE(b.credit_fils,0), v_threshold)::bigint AS credit_fils
      FROM per_user_pp a FULL OUTER JOIN per_user_upay_kwd b ON a.user_id = b.user_id
  ),
  combined_usd AS (
    SELECT COALESCE(a.user_id, b.user_id) AS user_id,
           LEAST(COALESCE(a.credit_fils,0) + COALESCE(b.credit_fils,0), v_threshold)::bigint AS credit_fils
      FROM per_user_pp a FULL OUTER JOIN per_user_upay_usd b ON a.user_id = b.user_id
  ),
  reach_pp   AS (SELECT user_id FROM per_user_pp WHERE credit_fils >= v_threshold),
  reach_kwd  AS (SELECT user_id FROM combined_kwd WHERE credit_fils >= v_threshold),
  reach_usd  AS (SELECT user_id FROM combined_usd WHERE credit_fils >= v_threshold),
  reach_union AS (
    SELECT user_id FROM reach_kwd
    UNION
    SELECT user_id FROM reach_usd
  ),
  reach_outcomes AS (
    SELECT u.user_id,
           EXISTS (SELECT 1 FROM reach_kwd k WHERE k.user_id = u.user_id) AS in_kwd,
           EXISTS (SELECT 1 FROM reach_usd s WHERE s.user_id = u.user_id) AS in_usd
      FROM reach_union u
  )
  SELECT jsonb_build_object(
    'ambiguity_note', 'transactions.amount_usd stores UPayments values whose true currency is unresolved. Execution remains BLOCKED.',
    'total_count',      COALESCE((SELECT n FROM totals),0),
    'completed_count',  COALESCE((SELECT completed_n FROM totals),0),
    'raw_value_total',  (SELECT raw_value_total FROM totals),
    'interpretation_A_values_as_KWD', jsonb_build_object(
      'conversion',     'ROUND(amount * 1000) = fils',
      'completed_capped_credit_fils', COALESCE((SELECT SUM(credit_fils)::bigint FROM per_user_upay_kwd),0),
      'users_with_credit', COALESCE((SELECT count(*) FROM per_user_upay_kwd WHERE credit_fils > 0),0)
    ),
    'interpretation_B_values_as_legacy_USD', jsonb_build_object(
      'conversion',     'ROUND(amount * 307.55) = fils',
      'completed_capped_credit_fils', COALESCE((SELECT SUM(credit_fils)::bigint FROM per_user_upay_usd),0),
      'users_with_credit', COALESCE((SELECT count(*) FROM per_user_upay_usd WHERE credit_fils > 0),0)
    ),
    'threshold_users', jsonb_build_object(
      'reach_on_paypal_only',                 COALESCE((SELECT count(*) FROM reach_pp),0),
      'reach_only_if_upayments_kwd',          COALESCE((SELECT count(*) FROM reach_kwd
                                                         WHERE user_id NOT IN (SELECT user_id FROM reach_pp)),0),
      'reach_only_if_upayments_legacy_usd',   COALESCE((SELECT count(*) FROM reach_usd
                                                         WHERE user_id NOT IN (SELECT user_id FROM reach_pp)),0),
      'ambiguous_outcome_users',              COALESCE((
        SELECT count(*) FROM reach_outcomes WHERE in_kwd <> in_usd
      ),0),
      'paypal_baseline', 'strict verified PayPal per-user capped totals'
    ),
    'duplicate_provider_reference_groups', (
      SELECT count(*) FROM (
        SELECT COALESCE(upayments_invoice_id, upayments_track_id) AS ref
          FROM up WHERE COALESCE(upayments_invoice_id, upayments_track_id) IS NOT NULL
         GROUP BY 1 HAVING count(*) > 1
      ) d
    )
  ) INTO v_tx_upay;

  IF (v_tx_upay->>'total_count')::int > 0 THEN
    v_blockers := v_blockers || ARRAY['upayments_currency_policy_unresolved'];
  END IF;

  -- === Proposed lifetime credit — strict verified PayPal only ===
  WITH pp_pos AS (
    SELECT t.* FROM public.transactions t
     WHERE lower(COALESCE(t.payment_gateway,'')) = 'paypal'
       AND lower(COALESCE(t.status,'')) IN ('completed','captured','success','paid')
       AND COALESCE(t.amount_usd,0) > 0
  ),
  pp_verified AS (
    SELECT p.* FROM pp_pos p
     WHERE EXISTS (SELECT 1 FROM public.user_subscriptions us
                    WHERE us.transaction_id = p.id
                      AND lower(COALESCE(us.status,'')) IN ('active','completed','paid','succeeded'))
       AND NOT EXISTS (SELECT 1 FROM public.user_subscriptions us
                    WHERE us.transaction_id = p.id
                      AND lower(COALESCE(us.status,'')) IN ('cancelled','canceled','refunded','revoked','chargeback','charged_back'))
       AND p.user_id IS NOT NULL
  ),
  pp_paid AS (
    SELECT user_id,
           LEAST(SUM(ROUND(COALESCE(amount_usd,0) * v_rate))::bigint, v_threshold)::bigint AS credit_fils
      FROM pp_verified
     GROUP BY user_id
  )
  SELECT jsonb_build_object(
    'source', 'strict verified PayPal only: linked positive-status subscription and no negative-status link; ROUND(amount * 307.55); per-user cap 30,000 fils',
    'users_with_credit',        COALESCE((SELECT count(*) FROM pp_paid WHERE credit_fils > 0),0),
    'total_credit_fils',        COALESCE((SELECT SUM(credit_fils)::bigint FROM pp_paid),0),
    'users_capped_at_threshold',COALESCE((SELECT count(*) FROM pp_paid WHERE credit_fils >= v_threshold),0),
    'threshold_fils',           v_threshold,
    'conversion_rate_fils_per_usd', v_rate
  ) INTO v_credits;

  -- Proposed entitlements (unchanged shape; active-lifetime honors end_date now)
  WITH s AS (
    SELECT us.user_id,
           lower(COALESCE(pl.tier,'unknown'))     AS tier,
           COALESCE(pl.is_lifetime,false)          AS is_lifetime,
           lower(COALESCE(us.status,''))           AS status,
           us.start_date, us.end_date
      FROM public.user_subscriptions us
      LEFT JOIN public.subscription_plans pl ON pl.id = us.plan_id
  ),
  active AS (
    SELECT * FROM s
     WHERE status IN ('active','completed','paid','succeeded')
       AND (end_date IS NULL OR end_date >= now())
  ),
  expired AS (
    SELECT * FROM s
     WHERE end_date IS NOT NULL AND end_date < now()
  ),
  proposed AS (
    SELECT user_id, 'library'::text AS scope, NULL::text AS collection_key,
           'subs_active_lifetime'::text AS source, 'active'::text AS state
      FROM active WHERE is_lifetime
    UNION
    SELECT user_id, 'collection', 'chatgpt_prompts',
           'subs_active_basic', 'active'
      FROM active WHERE NOT is_lifetime AND tier = 'basic'
    UNION
    SELECT user_id, 'collection', 'chatgpt_prompts',
           'subs_active_standard', 'active'
      FROM active WHERE NOT is_lifetime AND tier = 'standard'
    UNION
    SELECT user_id, 'collection', 'midjourney_prompts',
           'subs_active_standard', 'active'
      FROM active WHERE NOT is_lifetime AND tier = 'standard'
    UNION
    SELECT user_id, 'collection', 'chatgpt_prompts',
           'subs_expired_basic', 'expired'
      FROM expired WHERE NOT is_lifetime AND tier = 'basic'
    UNION
    SELECT user_id, 'collection', 'chatgpt_prompts',
           'subs_expired_standard', 'expired'
      FROM expired WHERE NOT is_lifetime AND tier = 'standard'
    UNION
    SELECT user_id, 'collection', 'midjourney_prompts',
           'subs_expired_standard', 'expired'
      FROM expired WHERE NOT is_lifetime AND tier = 'standard'
  ),
  cancelled_lifetime AS (
    SELECT DISTINCT user_id FROM s
     WHERE is_lifetime AND status NOT IN ('active','completed','paid','succeeded')
  )
  SELECT jsonb_build_object(
    'by_scope', COALESCE((
      SELECT jsonb_object_agg(scope, cnt)
        FROM (SELECT scope, count(*) AS cnt FROM proposed GROUP BY scope) z
    ), '{}'::jsonb),
    'by_collection_key_active', COALESCE((
      SELECT jsonb_object_agg(collection_key, cnt)
        FROM (
          SELECT collection_key, count(*) AS cnt
            FROM proposed
           WHERE scope='collection' AND state='active'
           GROUP BY collection_key
        ) z
    ), '{}'::jsonb),
    'by_collection_key_expired', COALESCE((
      SELECT jsonb_object_agg(collection_key, cnt)
        FROM (
          SELECT collection_key, count(*) AS cnt
            FROM proposed
           WHERE scope='collection' AND state='expired'
           GROUP BY collection_key
        ) z
    ), '{}'::jsonb),
    'active_total',   (SELECT count(*) FROM proposed WHERE state='active'),
    'expired_total',  (SELECT count(*) FROM proposed WHERE state='expired'),
    'unique_users_active',  (SELECT count(DISTINCT user_id) FROM proposed WHERE state='active'),
    'unique_users_expired', (SELECT count(DISTINCT user_id) FROM proposed WHERE state='expired'),
    'cancelled_lifetime_flagged_users',
      (SELECT count(*) FROM cancelled_lifetime),
    'by_source', COALESCE((
      SELECT jsonb_object_agg(source, cnt)
        FROM (SELECT source, count(*) AS cnt FROM proposed GROUP BY source) z
    ), '{}'::jsonb)
  ) INTO v_ents;

  -- Anomalies — add explicit strict-verified review buckets.
  SELECT jsonb_build_object(
    'missing_auth_users_for_subscriptions', (
      SELECT count(*) FROM public.user_subscriptions us
       WHERE us.user_id IS NULL
          OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = us.user_id)
    ),
    'missing_auth_users_for_transactions', (
      SELECT count(*) FROM public.transactions t
       WHERE t.user_id IS NULL
          OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.user_id)
    ),
    'transactions_without_subscription', (
      SELECT count(*) FROM public.transactions t
       WHERE NOT EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.transaction_id = t.id)
    ),
    'subscriptions_without_transaction', (
      SELECT count(*) FROM public.user_subscriptions us WHERE us.transaction_id IS NULL
    ),
    'subscriptions_with_missing_transaction', (
      SELECT count(*) FROM public.user_subscriptions us
       WHERE us.transaction_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = us.transaction_id)
    ),
    'subscriptions_without_plan', (
      SELECT count(*) FROM public.user_subscriptions WHERE plan_id IS NULL
    ),
    'duplicate_paypal_reference_groups', (
      SELECT count(*) FROM (
        SELECT COALESCE(paypal_order_id, paypal_payment_id) AS ref
          FROM public.transactions
         WHERE lower(COALESCE(payment_gateway,''))='paypal'
           AND COALESCE(paypal_order_id, paypal_payment_id) IS NOT NULL
         GROUP BY 1 HAVING count(*) > 1
      ) d
    ),
    'duplicate_upayments_reference_groups', (
      SELECT count(*) FROM (
        SELECT COALESCE(upayments_invoice_id, upayments_track_id) AS ref
          FROM public.transactions
         WHERE COALESCE(upayments_invoice_id, upayments_track_id) IS NOT NULL
         GROUP BY 1 HAVING count(*) > 1
      ) d
    ),
    'zero_amount_paypal_completed', (
      SELECT count(*) FROM public.transactions
       WHERE lower(COALESCE(payment_gateway,''))='paypal'
         AND status IN ('completed','captured','success','paid')
         AND COALESCE(amount_usd,0) = 0
    ),
    'zero_amount_upayments_completed', (
      SELECT count(*) FROM public.transactions
       WHERE (lower(COALESCE(payment_gateway,''))='upayments'
              OR upayments_invoice_id IS NOT NULL
              OR upayments_track_id IS NOT NULL)
         AND status IN ('completed','captured','success','paid')
         AND COALESCE(amount_usd,0) = 0
    ),
    'unsupported_currencies', (
      SELECT count(*) FROM public.transactions
       WHERE currency IS NOT NULL AND upper(currency) NOT IN ('USD','KWD')
    ),
    'unsupported_gateways', (
      SELECT count(*) FROM public.transactions
       WHERE payment_gateway IS NOT NULL
         AND lower(payment_gateway) NOT IN ('paypal','upayments')
    ),
    'transactions_status_mismatch_completed_zero', (
      SELECT count(*) FROM public.transactions
       WHERE status IN ('completed','captured','success','paid')
         AND COALESCE(amount_usd,0) = 0
    ),
    'subscriptions_expired_but_status_active', (
      SELECT count(*) FROM public.user_subscriptions
       WHERE lower(COALESCE(status,''))='active'
         AND end_date IS NOT NULL AND end_date < now()
    ),
    'cancelled_lifetime_users', (
      SELECT count(DISTINCT us.user_id)
        FROM public.user_subscriptions us
        LEFT JOIN public.subscription_plans pl ON pl.id = us.plan_id
       WHERE COALESCE(pl.is_lifetime,false) = true
         AND lower(COALESCE(us.status,'')) NOT IN ('active','completed','paid','succeeded')
    ),
    'ambiguous_upayments_amount_rows', (
      SELECT count(*) FROM public.transactions
       WHERE (lower(COALESCE(payment_gateway,''))='upayments'
              OR upayments_invoice_id IS NOT NULL
              OR upayments_track_id IS NOT NULL)
    ),
    'paypal_unlinked_positive_completed_review_rows', (
      SELECT count(*) FROM public.transactions t
       WHERE lower(COALESCE(t.payment_gateway,''))='paypal'
         AND lower(COALESCE(t.status,'')) IN ('completed','captured','success','paid')
         AND COALESCE(t.amount_usd,0) > 0
         AND NOT EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.transaction_id = t.id)
    ),
    'paypal_negative_linked_review_rows', (
      SELECT count(*) FROM public.transactions t
       WHERE lower(COALESCE(t.payment_gateway,''))='paypal'
         AND lower(COALESCE(t.status,'')) IN ('completed','captured','success','paid')
         AND COALESCE(t.amount_usd,0) > 0
         AND EXISTS (SELECT 1 FROM public.user_subscriptions us
                      WHERE us.transaction_id = t.id
                        AND lower(COALESCE(us.status,'')) IN ('cancelled','canceled','refunded','revoked','chargeback','charged_back'))
    ),
    'unmatched_legacy_prompts', (
      SELECT count(*) FROM public.prompts p
       WHERE NOT EXISTS (SELECT 1 FROM public.resources r WHERE r.legacy_prompt_id = p.id)
    )
  ) INTO v_anomalies;

  v_contract := jsonb_build_object(
    'note',
      'Final migration grant contract (deferred; no callable execute RPC exists).',
    'rules', jsonb_build_array(
      jsonb_build_object('rule','expired_predecessor_close',
        'detail','Before inserting a new active resource/collection/library grant, any expired-but-unrevoked predecessor for the same (user_id, scope, resource_id-or-collection_key) MUST be revoked with revoke_reason=''migration_supersede'' OR deterministically reused/extended in place.'),
      jsonb_build_object('rule','concurrent_duplicate_prevention',
        'detail','Partial unique index on (user_id, collection_key) WHERE scope=collection AND revoked_at IS NULL prevents concurrent duplicate active collection grants; library grants keep per-user/reason unique index.'),
      jsonb_build_object('rule','resource_scope_per_user_idempotency',
        'detail','Resource-scoped grants must enforce per (user_id, resource_id, version_major) idempotency in code by upserting/reusing the active row.'),
      jsonb_build_object('rule','no_execute_rpc',
        'detail','No callable v2_admin_execute_migration exists.')
    )
  );

  v_legacy_plans := jsonb_build_array(
    jsonb_build_object(
      'plan','basic','price_usd',55,'duration','365_days','is_lifetime',false,
      'original_promise','ChatGPT prompts only; explicit 1-year access',
      'proposed_v2_scope','collection:chatgpt_prompts',
      'expiry_treatment','preserve original end_date; expired end_date => historical only'
    ),
    jsonb_build_object(
      'plan','standard','price_usd',65,'duration','365_days','is_lifetime',false,
      'original_promise','ChatGPT + Midjourney prompts; explicit 1-year access',
      'proposed_v2_scope','collection:chatgpt_prompts + collection:midjourney_prompts',
      'expiry_treatment','preserve original end_date; expired end_date => historical only'
    ),
    jsonb_build_object(
      'plan','premium','price_usd',80,'duration','lifetime','is_lifetime',true,
      'original_promise','ChatGPT, Midjourney, n8n, all future categories; lifetime',
      'proposed_v2_scope','library (all current & future Jojo-owned digital resources)',
      'expiry_treatment','no expiry; cancelled => manual review'
    ),
    jsonb_build_object(
      'plan','ultimate','price_usd',100,'duration','lifetime','is_lifetime',true,
      'original_promise','Full lifetime scope + historical special-request benefit',
      'proposed_v2_scope','library (all current & future Jojo-owned digital resources)',
      'expiry_treatment','no expiry; cancelled => manual review'
    )
  );

  v_policy := jsonb_build_object(
    'version','6B.1-c1',
    'lifetime_threshold_fils', v_threshold,
    'lifetime_threshold_kwd', 30,
    'conversion_rate_fils_per_usd', v_rate,
    'library_scope_includes', jsonb_build_array(
      'jojo_skills','jojo_automations','jojo_prompts','jojo_image_styles','jojo_bundles',
      'all_future_jojo_owned_digital_resources','all_future_updates_to_included_resources'
    ),
    'library_scope_excludes', jsonb_build_array(
      'creator_products','api_or_ai_credits','cloud_execution_costs',
      'third_party_licenses','consulting_or_custom_work','other_recurring_cost_services'
    ),
    'active_definition','status in (active, completed, paid, succeeded) AND (end_date IS NULL OR end_date >= now())',
    'expired_definition','end_date IS NOT NULL AND end_date < now(); historical only',
    'cancelled_treatment','no automatic entitlement; per-user manual review only if no valid active grant supersedes',
    'lifetime_credit_rules', jsonb_build_object(
      'paypal_deterministic','Strict verified only: PayPal + completed/captured/success/paid + amount_usd>0 + at least one linked positive-status subscription + no linked negative-status subscription; ROUND(amount_usd * 307.55) fils per row; per-user cap 30,000 fils.',
      'paypal_unlinked_review','Positive completed PayPal payments with no linked subscription go to manual review and are excluded from verified credit until reviewed.',
      'paypal_negative_linked_review','Positive completed PayPal payments whose linked subscription is cancelled/refunded/revoked/chargeback go to manual review and are excluded from verified credit until reviewed.',
      'upayments_unresolved','Currency ambiguity is a hard execution blocker; both interpretations shown; no choice made.',
      'lifetime_members_ui','Full-lifetime members see lifetime active, not remaining-credit progress.',
      'v2_individual_purchases','Continue to count toward the 30 KWD threshold post-migration through the main lifetime progress system.',
      'excluded_from_credit','Creator products, external consumption, refunded/negative transactions, UPayments (pending policy).'
    ),
    'no_execute_rpc',true,
    'plans', v_legacy_plans,
    'copy', jsonb_build_object(
      'en', jsonb_build_object(
        'lifetime','Founding Full Library Lifetime — lifetime access to every current and future Jojo-owned digital resource. Excludes creator products, API/AI credits, cloud costs, third-party licenses and custom work.',
        'basic','You had one-year access to the ChatGPT collection.',
        'standard','You had one-year access to the ChatGPT and Midjourney collections.',
        'credit','Verified historical PayPal payments count toward the 30.000 KWD lifetime threshold. Unlinked or refunded PayPal payments and all UPayments payments stay under review.',
        'cancelled','Cancelled or refunded plans are held for manual review only when no valid active grant already covers the same access.'
      ),
      'ar', jsonb_build_object(
        'lifetime','عضوية المكتبة الكاملة مدى الحياة — وصول دائم لكل موارد جوجو الرقمية الحالية والمستقبلية. لا تشمل منتجات المبدعين أو رصيد الذكاء الاصطناعي أو التكاليف السحابية أو التراخيص الخارجية أو الأعمال المخصصة.',
        'basic','كان لديك وصول لمدة سنة لمجموعة ChatGPT.',
        'standard','كان لديك وصول لمدة سنة لمجموعتي ChatGPT وMidjourney.',
        'credit','المدفوعات السابقة عبر PayPal الموثّقة تُحتسب ضمن حد الـ 30.000 دينار. المدفوعات غير المرتبطة أو المسترجعة ومدفوعات UPayments قيد المراجعة.',
        'cancelled','الخطط الملغاة أو المسترجعة تُحفظ للمراجعة اليدوية فقط إذا لم يوجد وصول نشط بديل يغطي نفس الحقوق.'
      )
    )
  );

  RETURN jsonb_build_object(
    'generated_at', now(),
    'conversion_rate_fils_per_usd', v_rate,
    'threshold_fils', v_threshold,
    'execute_enabled', false,
    'execution_blockers', to_jsonb(v_blockers),
    'catalog', v_catalog,
    'collections', v_collections,
    'unmatched_sample', v_unmatched,
    'subscriptions', v_subs,
    'plan_cohorts', v_plan_cohorts,
    'transactions_paypal', v_tx_paypal,
    'transactions_upayments', v_tx_upay,
    'proposed_entitlements', v_ents,
    'proposed_lifetime_credit', v_credits,
    'anomalies', v_anomalies,
    'grant_contract', v_contract,
    'grandfathering_policy', v_policy
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.v2_admin_migration_preview() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.v2_admin_migration_preview() FROM anon;
GRANT  EXECUTE ON FUNCTION public.v2_admin_migration_preview() TO authenticated;

-- 2) Customer self-only summary — null-safe, superseding, standard-over-basic, review buckets.
CREATE OR REPLACE FUNCTION public.v2_my_legacy_access_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid            uuid := auth.uid();
  v_rate           numeric := 307.55;
  v_threshold      int     := 30000;
  v_has_ultimate   boolean := false;
  v_has_premium    boolean := false;
  v_has_basic_active   boolean := false;
  v_has_standard_active boolean := false;
  v_has_basic_expired  boolean := false;
  v_has_standard_expired boolean := false;
  v_has_cancelled_lifetime boolean := false;
  v_basic_expiry   timestamptz;
  v_standard_expiry timestamptz;
  v_credit_fils    bigint := 0;
  v_has_upayments  boolean := false;
  v_has_pp_unlinked boolean := false;
  v_has_pp_neg     boolean := false;
  v_membership_type text;
  v_collections    jsonb := '[]'::jsonb;
  v_manual_review  boolean := false;
  v_lifetime       boolean := false;
  v_expired_hist   boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  SELECT
    COALESCE(bool_or(pl.is_lifetime AND lower(pl.tier)='ultimate'
            AND lower(us.status) IN ('active','completed','paid','succeeded')
            AND (us.end_date IS NULL OR us.end_date >= now())), false),
    COALESCE(bool_or(pl.is_lifetime AND lower(pl.tier)='premium'
            AND lower(us.status) IN ('active','completed','paid','succeeded')
            AND (us.end_date IS NULL OR us.end_date >= now())), false),
    COALESCE(bool_or(NOT pl.is_lifetime AND lower(pl.tier)='basic'
            AND lower(us.status) IN ('active','completed','paid','succeeded')
            AND (us.end_date IS NULL OR us.end_date >= now())), false),
    COALESCE(bool_or(NOT pl.is_lifetime AND lower(pl.tier)='standard'
            AND lower(us.status) IN ('active','completed','paid','succeeded')
            AND (us.end_date IS NULL OR us.end_date >= now())), false),
    COALESCE(bool_or(NOT pl.is_lifetime AND lower(pl.tier)='basic'
            AND lower(us.status) IN ('active','completed','paid','succeeded')
            AND us.end_date IS NOT NULL AND us.end_date < now()), false),
    COALESCE(bool_or(NOT pl.is_lifetime AND lower(pl.tier)='standard'
            AND lower(us.status) IN ('active','completed','paid','succeeded')
            AND us.end_date IS NOT NULL AND us.end_date < now()), false),
    COALESCE(bool_or(pl.is_lifetime
            AND lower(us.status) IN ('cancelled','canceled','refunded','revoked','chargeback','charged_back')), false),
    -- Expiry from positive-status Basic/Standard rows only, ignoring cancelled duplicates.
    max(CASE WHEN NOT pl.is_lifetime AND lower(pl.tier)='basic'
             AND lower(us.status) IN ('active','completed','paid','succeeded')
             THEN us.end_date END),
    max(CASE WHEN NOT pl.is_lifetime AND lower(pl.tier)='standard'
             AND lower(us.status) IN ('active','completed','paid','succeeded')
             THEN us.end_date END)
  INTO
    v_has_ultimate, v_has_premium,
    v_has_basic_active, v_has_standard_active,
    v_has_basic_expired, v_has_standard_expired,
    v_has_cancelled_lifetime,
    v_basic_expiry, v_standard_expiry
  FROM public.user_subscriptions us
  LEFT JOIN public.subscription_plans pl ON pl.id = us.plan_id
  WHERE us.user_id = v_uid;

  -- Strict verified PayPal credit for caller.
  SELECT LEAST(COALESCE(SUM(ROUND(COALESCE(t.amount_usd,0) * v_rate))::bigint, 0), v_threshold)::bigint
    INTO v_credit_fils
    FROM public.transactions t
   WHERE t.user_id = v_uid
     AND lower(COALESCE(t.payment_gateway,'')) = 'paypal'
     AND lower(COALESCE(t.status,'')) IN ('completed','captured','success','paid')
     AND COALESCE(t.amount_usd,0) > 0
     AND EXISTS (SELECT 1 FROM public.user_subscriptions us
                  WHERE us.transaction_id = t.id
                    AND lower(COALESCE(us.status,'')) IN ('active','completed','paid','succeeded'))
     AND NOT EXISTS (SELECT 1 FROM public.user_subscriptions us
                  WHERE us.transaction_id = t.id
                    AND lower(COALESCE(us.status,'')) IN ('cancelled','canceled','refunded','revoked','chargeback','charged_back'));

  SELECT
    EXISTS (SELECT 1 FROM public.transactions t
             WHERE t.user_id = v_uid
               AND (lower(COALESCE(t.payment_gateway,''))='upayments'
                    OR t.upayments_invoice_id IS NOT NULL
                    OR t.upayments_track_id IS NOT NULL)),
    EXISTS (SELECT 1 FROM public.transactions t
             WHERE t.user_id = v_uid
               AND lower(COALESCE(t.payment_gateway,''))='paypal'
               AND lower(COALESCE(t.status,'')) IN ('completed','captured','success','paid')
               AND COALESCE(t.amount_usd,0) > 0
               AND NOT EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.transaction_id = t.id)),
    EXISTS (SELECT 1 FROM public.transactions t
             WHERE t.user_id = v_uid
               AND lower(COALESCE(t.payment_gateway,''))='paypal'
               AND lower(COALESCE(t.status,'')) IN ('completed','captured','success','paid')
               AND COALESCE(t.amount_usd,0) > 0
               AND EXISTS (SELECT 1 FROM public.user_subscriptions us
                            WHERE us.transaction_id = t.id
                              AND lower(COALESCE(us.status,'')) IN ('cancelled','canceled','refunded','revoked','chargeback','charged_back')))
  INTO v_has_upayments, v_has_pp_unlinked, v_has_pp_neg;

  v_lifetime := (v_has_ultimate OR v_has_premium);

  -- Classification: Standard supersedes Basic; lifetime supersedes all.
  IF v_has_ultimate THEN v_membership_type := 'ultimate';
  ELSIF v_has_premium THEN v_membership_type := 'premium';
  ELSIF v_has_standard_active THEN v_membership_type := 'standard';
  ELSIF v_has_basic_active THEN v_membership_type := 'basic';
  ELSIF v_has_standard_expired THEN v_membership_type := 'standard_expired';
  ELSIF v_has_basic_expired THEN v_membership_type := 'basic_expired';
  ELSIF v_has_cancelled_lifetime THEN v_membership_type := 'cancelled_lifetime_review';
  ELSE v_membership_type := 'none';
  END IF;

  -- Collections: lifetime -> library only. Otherwise standard supersedes basic.
  IF v_lifetime THEN
    v_collections := jsonb_build_array('library');
  ELSIF v_has_standard_active THEN
    v_collections := jsonb_build_array('chatgpt_prompts','midjourney_prompts');
  ELSIF v_has_basic_active THEN
    v_collections := jsonb_build_array('chatgpt_prompts');
  ELSE
    v_collections := '[]'::jsonb;
  END IF;

  -- "Expired historical" is suppressed when a superseding active grant exists.
  v_expired_hist := (v_has_basic_expired OR v_has_standard_expired)
                    AND NOT v_lifetime
                    AND NOT v_has_standard_active
                    AND NOT v_has_basic_active;

  -- Manual review is only meaningful when no active grant supersedes the cancelled record.
  v_manual_review := v_has_cancelled_lifetime
                     AND NOT v_lifetime
                     AND NOT v_has_standard_active
                     AND NOT v_has_basic_active;

  RETURN jsonb_build_object(
    'membership_type', v_membership_type,
    'lifetime', v_lifetime,
    'included_collection_keys', v_collections,
    'basic_expiry',    v_basic_expiry,
    'standard_expiry', v_standard_expiry,
    'has_expired_historical', v_expired_hist,
    'manual_review_required', v_manual_review,
    'paypal_verified_credit_fils', v_credit_fils,
    'lifetime_threshold_fils', v_threshold,
    'remaining_lifetime_fils', GREATEST(v_threshold - v_credit_fils, 0),
    'payment_history_under_review', (v_has_upayments OR v_has_pp_unlinked OR v_has_pp_neg),
    'copy', jsonb_build_object(
      'en', CASE
        WHEN v_membership_type = 'ultimate' THEN 'Founding Full Library Lifetime (Ultimate) — lifetime access to every current and future Jojo-owned digital resource. Excludes creator products, API/AI credits, cloud costs, third-party licenses, and custom work.'
        WHEN v_membership_type = 'premium'  THEN 'Founding Full Library Lifetime (Premium) — lifetime access to every current and future Jojo-owned digital resource. Excludes creator products, API/AI credits, cloud costs, third-party licenses, and custom work.'
        WHEN v_membership_type = 'standard' THEN 'You have access to the ChatGPT and Midjourney collections until your original expiry.'
        WHEN v_membership_type = 'basic'    THEN 'You have access to the ChatGPT collection until your original expiry.'
        WHEN v_membership_type = 'standard_expired' THEN 'Your original one-year Standard access has ended. This is shown as historical access only and is not active.'
        WHEN v_membership_type = 'basic_expired'    THEN 'Your original one-year Basic access has ended. This is shown as historical access only and is not active.'
        WHEN v_membership_type = 'cancelled_lifetime_review' THEN 'A cancelled lifetime plan is held for manual review and is not automatically converted.'
        ELSE 'No legacy access on record.'
      END,
      'ar', CASE
        WHEN v_membership_type = 'ultimate' THEN 'عضوية المكتبة الكاملة مدى الحياة (ألتيميت) — وصول دائم لكل موارد جوجو الرقمية الحالية والمستقبلية. لا تشمل منتجات المبدعين أو رصيد الذكاء الاصطناعي أو التكاليف السحابية أو التراخيص الخارجية أو الأعمال المخصصة.'
        WHEN v_membership_type = 'premium'  THEN 'عضوية المكتبة الكاملة مدى الحياة (بريميوم) — وصول دائم لكل موارد جوجو الرقمية الحالية والمستقبلية. لا تشمل منتجات المبدعين أو رصيد الذكاء الاصطناعي أو التكاليف السحابية أو التراخيص الخارجية أو الأعمال المخصصة.'
        WHEN v_membership_type = 'standard' THEN 'لديك وصول لمجموعتي ChatGPT وMidjourney حتى تاريخ انتهاء الاشتراك الأصلي.'
        WHEN v_membership_type = 'basic'    THEN 'لديك وصول لمجموعة ChatGPT حتى تاريخ انتهاء الاشتراك الأصلي.'
        WHEN v_membership_type = 'standard_expired' THEN 'انتهت مدة اشتراك ستاندرد الأصلية. تظهر كأرشيف تاريخي وليست نشطة.'
        WHEN v_membership_type = 'basic_expired'    THEN 'انتهت مدة اشتراك بيسك الأصلية. تظهر كأرشيف تاريخي وليست نشطة.'
        WHEN v_membership_type = 'cancelled_lifetime_review' THEN 'الخطة الدائمة الملغاة محفوظة للمراجعة اليدوية ولا تُحوَّل تلقائياً.'
        ELSE 'لا يوجد وصول قديم مسجل.'
      END
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.v2_my_legacy_access_summary() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.v2_my_legacy_access_summary() FROM anon;
REVOKE EXECUTE ON FUNCTION public.v2_my_legacy_access_summary() FROM service_role;
GRANT  EXECUTE ON FUNCTION public.v2_my_legacy_access_summary() TO authenticated;
