
-- =============================================================================
-- Phase 6B.1 Rehearsal Gate — forward-only, READ-ONLY.
-- No data mutations. No execute RPC. Existing RLS preserved.
-- =============================================================================

-- 1) Minimal idempotency schema for a future, separately-approved executor.
ALTER TABLE public.lifetime_credit_entries
  ADD COLUMN IF NOT EXISTS legacy_transaction_id uuid NULL
    REFERENCES public.transactions(id);

CREATE UNIQUE INDEX IF NOT EXISTS lifetime_credit_entries_legacy_tx_uidx
  ON public.lifetime_credit_entries (legacy_transaction_id)
  WHERE legacy_transaction_id IS NOT NULL;

-- Entitlement legacy-source uniqueness. Standard produces two grants (chatgpt +
-- midjourney) so the key must include the normalized collection_key AND
-- resource_id to allow both while still blocking duplicate replays.
CREATE UNIQUE INDEX IF NOT EXISTS entitlements_legacy_source_active_uidx
  ON public.entitlements (
    user_id,
    legacy_source,
    scope,
    COALESCE(collection_key, ''),
    COALESCE(resource_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE legacy_source IS NOT NULL AND revoked_at IS NULL;

-- =============================================================================
-- 2) Preview: drop KWD/USD interpretation ambiguity; use code-reconstructed KWD.
--    Base fils map: basic 15000 / standard 20000 / premium 25000 / ultimate 30000.
--    For a UPayments row, inferred fils = ROUND(base_fils * amount_usd / price_usd).
-- =============================================================================
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
  v_combined     jsonb;
  v_anomalies    jsonb;
  v_contract     jsonb;
  v_policy       jsonb;
  v_legacy_plans jsonb;
  v_blockers     text[] := ARRAY['no_executor_available']::text[];
BEGIN
  PERFORM public._v2_require_admin();

  -- Catalog
  WITH prompts_c AS (SELECT count(*) AS c FROM public.prompts),
       matched AS (SELECT count(*) AS c FROM public.resources WHERE legacy_prompt_id IS NOT NULL),
       versions_c AS (SELECT count(*) AS c FROM public.resource_versions rv
                       JOIN public.resources r ON r.id = rv.resource_id
                      WHERE r.legacy_prompt_id IS NOT NULL),
       products_c AS (SELECT count(*) AS c FROM public.products p
                       JOIN public.resources r ON r.id = p.resource_id
                      WHERE r.legacy_prompt_id IS NOT NULL),
       unmatched_prompts AS (SELECT count(*) AS c FROM public.prompts p
                              WHERE NOT EXISTS (SELECT 1 FROM public.resources r WHERE r.legacy_prompt_id = p.id))
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
     ORDER BY r.created_at ASC LIMIT 25
  ) x;

  -- Subscription rollup
  WITH sub_rollup AS (
    SELECT lower(COALESCE(pl.tier,'unknown')) AS tier,
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
      'tier', tier, 'is_lifetime', is_lifetime, 'status', status,
      'count', n, 'expired', expired_n, 'active_or_perpetual', active_n,
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

  -- Plan cohorts (unchanged from corrective pass)
  WITH s AS (
    SELECT us.user_id,
           lower(COALESCE(pl.tier,'unknown')) AS tier,
           COALESCE(pl.is_lifetime,false)     AS is_lifetime,
           lower(COALESCE(us.status,''))      AS status,
           us.start_date, us.end_date
      FROM public.user_subscriptions us
      LEFT JOIN public.subscription_plans pl ON pl.id = us.plan_id
     WHERE us.user_id IS NOT NULL
  ),
  positive_status AS (SELECT * FROM s WHERE status IN ('active','completed','paid','succeeded')),
  lifetime_active AS (
    SELECT DISTINCT user_id, tier FROM positive_status
     WHERE is_lifetime AND (end_date IS NULL OR end_date >= now())
  ),
  premium_active  AS (SELECT DISTINCT user_id FROM lifetime_active WHERE tier='premium'),
  ultimate_active AS (SELECT DISTINCT user_id FROM lifetime_active WHERE tier='ultimate'),
  lifetime_active_users AS (SELECT user_id FROM premium_active UNION SELECT user_id FROM ultimate_active),
  ultimate_cancelled_raw AS (SELECT * FROM s WHERE is_lifetime AND tier='ultimate'
                              AND status NOT IN ('active','completed','paid','succeeded')),
  premium_cancelled_raw  AS (SELECT * FROM s WHERE is_lifetime AND tier='premium'
                              AND status NOT IN ('active','completed','paid','succeeded')),
  ultimate_cancelled_unresolved AS (
    SELECT DISTINCT user_id FROM ultimate_cancelled_raw
     WHERE user_id NOT IN (SELECT user_id FROM lifetime_active_users)),
  premium_cancelled_unresolved AS (
    SELECT DISTINCT user_id FROM premium_cancelled_raw
     WHERE user_id NOT IN (SELECT user_id FROM lifetime_active_users)),
  basic_active AS (
    SELECT DISTINCT user_id FROM positive_status
     WHERE NOT is_lifetime AND tier='basic' AND (end_date IS NULL OR end_date >= now())
       AND user_id NOT IN (SELECT user_id FROM lifetime_active_users)),
  standard_active AS (
    SELECT DISTINCT user_id FROM positive_status
     WHERE NOT is_lifetime AND tier='standard' AND (end_date IS NULL OR end_date >= now())
       AND user_id NOT IN (SELECT user_id FROM lifetime_active_users)),
  basic_expired AS (
    SELECT DISTINCT user_id FROM positive_status
     WHERE NOT is_lifetime AND tier='basic' AND end_date IS NOT NULL AND end_date < now()
       AND user_id NOT IN (SELECT user_id FROM basic_active)
       AND user_id NOT IN (SELECT user_id FROM standard_active)
       AND user_id NOT IN (SELECT user_id FROM lifetime_active_users)),
  standard_expired AS (
    SELECT DISTINCT user_id FROM positive_status
     WHERE NOT is_lifetime AND tier='standard' AND end_date IS NOT NULL AND end_date < now()
       AND user_id NOT IN (SELECT user_id FROM standard_active)
       AND user_id NOT IN (SELECT user_id FROM lifetime_active_users)),
  basic_cancelled_raw AS (SELECT * FROM s WHERE NOT is_lifetime AND tier='basic'
                            AND status NOT IN ('active','completed','paid','succeeded')),
  standard_cancelled_raw AS (SELECT * FROM s WHERE NOT is_lifetime AND tier='standard'
                            AND status NOT IN ('active','completed','paid','succeeded')),
  basic_cancelled_unresolved AS (
    SELECT DISTINCT user_id FROM basic_cancelled_raw
     WHERE user_id NOT IN (SELECT user_id FROM lifetime_active_users)
       AND user_id NOT IN (SELECT user_id FROM basic_active)
       AND user_id NOT IN (SELECT user_id FROM standard_active)),
  standard_cancelled_unresolved AS (
    SELECT DISTINCT user_id FROM standard_cancelled_raw
     WHERE user_id NOT IN (SELECT user_id FROM lifetime_active_users)
       AND user_id NOT IN (SELECT user_id FROM standard_active))
  SELECT jsonb_build_object(
    'ultimate_active_lifetime_users',      (SELECT count(*) FROM ultimate_active),
    'premium_active_lifetime_users',       (SELECT count(*) FROM premium_active),
    'ultimate_cancelled_source_rows',      (SELECT count(*) FROM ultimate_cancelled_raw),
    'premium_cancelled_source_rows',       (SELECT count(*) FROM premium_cancelled_raw),
    'basic_cancelled_source_rows',         (SELECT count(*) FROM basic_cancelled_raw),
    'standard_cancelled_source_rows',      (SELECT count(*) FROM standard_cancelled_raw),
    'ultimate_cancelled_unresolved_users', (SELECT count(*) FROM ultimate_cancelled_unresolved),
    'premium_cancelled_unresolved_users',  (SELECT count(*) FROM premium_cancelled_unresolved),
    'basic_cancelled_unresolved_users',    (SELECT count(*) FROM basic_cancelled_unresolved),
    'standard_cancelled_unresolved_users', (SELECT count(*) FROM standard_cancelled_unresolved),
    'ultimate_cancelled_review_users',     (SELECT count(*) FROM ultimate_cancelled_unresolved),
    'premium_cancelled_review_users',      (SELECT count(*) FROM premium_cancelled_unresolved),
    'basic_cancelled_review_users',        (SELECT count(*) FROM basic_cancelled_unresolved),
    'standard_cancelled_review_users',     (SELECT count(*) FROM standard_cancelled_unresolved),
    'basic_active_users',                  (SELECT count(*) FROM basic_active),
    'standard_active_users',               (SELECT count(*) FROM standard_active),
    'basic_expired_historical_users',      (SELECT count(*) FROM basic_expired),
    'standard_expired_historical_users',   (SELECT count(*) FROM standard_expired),
    'raw_row_counts_by_tier_status', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('tier', tier, 'is_lifetime', is_lifetime, 'status', status, 'rows', n))
        FROM (SELECT tier, is_lifetime, status, count(*) AS n FROM s GROUP BY 1,2,3 ORDER BY 1,2,3) z
    ), '[]'::jsonb)
  ) INTO v_plan_cohorts;

  -- PayPal strict verified (unchanged)
  WITH pp AS (SELECT t.* FROM public.transactions t
              WHERE lower(COALESCE(t.payment_gateway,'')) = 'paypal'),
  pp_pos AS (SELECT * FROM pp
              WHERE lower(COALESCE(status,'')) IN ('completed','captured','success','paid')
                AND COALESCE(amount_usd,0) > 0),
  pp_class AS (
    SELECT p.*,
      EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.transaction_id = p.id
               AND lower(COALESCE(us.status,'')) IN ('active','completed','paid','succeeded')) AS has_pos_link,
      EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.transaction_id = p.id
               AND lower(COALESCE(us.status,'')) IN ('cancelled','canceled','refunded','revoked','chargeback','charged_back')) AS has_neg_link,
      EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.transaction_id = p.id) AS any_link
      FROM pp_pos p),
  pp_verified AS (SELECT * FROM pp_class WHERE has_pos_link AND NOT has_neg_link),
  pp_unlinked_review AS (SELECT * FROM pp_class WHERE NOT any_link),
  pp_neg_review AS (SELECT * FROM pp_class WHERE has_neg_link),
  by_status AS (SELECT status, count(*) AS n,
                       SUM(COALESCE(amount_usd,0))::numeric(20,2) AS usd_total,
                       SUM(ROUND(COALESCE(amount_usd,0) * v_rate))::bigint AS fils_total
                  FROM pp GROUP BY status),
  per_user_verified AS (
    SELECT user_id, LEAST(SUM(ROUND(COALESCE(amount_usd,0) * v_rate))::bigint, v_threshold)::bigint AS credit_fils
      FROM pp_verified WHERE user_id IS NOT NULL GROUP BY user_id)
  SELECT jsonb_build_object(
    'classification', 'strict verified PayPal',
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
    'proposed_credit_fils_completed_precap', COALESCE((SELECT SUM(ROUND(COALESCE(amount_usd,0) * v_rate))::bigint FROM pp_verified), 0),
    'zero_amount_count', (SELECT count(*) FROM pp WHERE COALESCE(amount_usd,0) = 0),
    'missing_subscription_link', (SELECT count(*) FROM pp_unlinked_review),
    'duplicate_provider_reference_groups', (
      SELECT count(*) FROM (SELECT COALESCE(paypal_order_id, paypal_payment_id) AS ref
        FROM pp WHERE COALESCE(paypal_order_id, paypal_payment_id) IS NOT NULL
        GROUP BY 1 HAVING count(*) > 1) d)
  ) INTO v_tx_paypal;

  -- UPayments — code-reconstructed KWD from historical plan price map.
  -- Base fils map: basic 15000, standard 20000, premium 25000, ultimate 30000.
  -- Ratio = amount_usd / plan.price_usd (must be >0 and <=1).
  -- Requires: gateway upayments (or upayments ids), currency='KWD', completed status,
  -- amount_usd>0, known tier via linked positive-status sub with a mapped plan,
  -- plan.price_usd>0, and no linked negative-status subscription.
  WITH up_all AS (
    SELECT t.* FROM public.transactions t
     WHERE lower(COALESCE(t.payment_gateway,'')) = 'upayments'
        OR t.upayments_invoice_id IS NOT NULL
        OR t.upayments_track_id IS NOT NULL
  ),
  up_class AS (
    SELECT u.*,
      -- pick the first positive-status linked subscription's plan tier + price
      (SELECT lower(pl.tier) FROM public.user_subscriptions us
         JOIN public.subscription_plans pl ON pl.id = us.plan_id
        WHERE us.transaction_id = u.id
          AND lower(COALESCE(us.status,'')) IN ('active','completed','paid','succeeded')
        LIMIT 1) AS linked_tier,
      (SELECT pl.price_usd FROM public.user_subscriptions us
         JOIN public.subscription_plans pl ON pl.id = us.plan_id
        WHERE us.transaction_id = u.id
          AND lower(COALESCE(us.status,'')) IN ('active','completed','paid','succeeded')
        LIMIT 1) AS linked_plan_price_usd,
      EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.transaction_id = u.id
                AND lower(COALESCE(us.status,'')) IN ('cancelled','canceled','refunded','revoked','chargeback','charged_back')) AS has_neg_link,
      EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.transaction_id = u.id) AS any_link
      FROM up_all u
  ),
  up_completed AS (
    SELECT * FROM up_class WHERE lower(COALESCE(status,'')) IN ('completed','captured','success','paid')
  ),
  up_pending AS (
    SELECT * FROM up_class WHERE lower(COALESCE(status,'')) NOT IN ('completed','captured','success','paid','refunded','cancelled','canceled','failed','declined','error')
  ),
  up_completed_kwd AS (
    SELECT * FROM up_completed
     WHERE upper(COALESCE(currency,'')) = 'KWD'
       AND COALESCE(amount_usd,0) > 0
  ),
  up_completed_reconstructable AS (
    SELECT c.*,
      CASE c.linked_tier
        WHEN 'basic'    THEN 15000
        WHEN 'standard' THEN 20000
        WHEN 'premium'  THEN 25000
        WHEN 'ultimate' THEN 30000
        ELSE NULL::int END AS base_fils
      FROM up_completed_kwd c
     WHERE c.linked_tier IN ('basic','standard','premium','ultimate')
       AND COALESCE(c.linked_plan_price_usd,0) > 0
  ),
  up_strict_verified AS (
    SELECT r.*,
           (r.amount_usd / r.linked_plan_price_usd)::numeric AS ratio,
           ROUND(r.base_fils * r.amount_usd / r.linked_plan_price_usd)::bigint AS inferred_fils
      FROM up_completed_reconstructable r
     WHERE (r.amount_usd / r.linked_plan_price_usd) > 0
       AND (r.amount_usd / r.linked_plan_price_usd) <= 1
       AND r.any_link
       AND NOT r.has_neg_link
       AND r.user_id IS NOT NULL
  ),
  up_neg_review AS (
    SELECT * FROM up_completed_kwd WHERE has_neg_link
  ),
  up_unlinked_review AS (
    SELECT * FROM up_completed_kwd WHERE NOT any_link
  ),
  per_user_up AS (
    SELECT user_id, LEAST(SUM(inferred_fils)::bigint, v_threshold)::bigint AS credit_fils
      FROM up_strict_verified
     GROUP BY user_id
  )
  SELECT jsonb_build_object(
    'policy', 'code-reconstructed KWD from historical plan price map',
    'note',   'legacy rows did not persist provider-returned KWD amount; values are reconstructed deterministically from the checkout code contract, not independently verified by the provider',
    'base_fils_by_tier', jsonb_build_object('basic',15000,'standard',20000,'premium',25000,'ultimate',30000),
    'per_user_cap_fils', v_threshold,
    'total_count',        COALESCE((SELECT count(*) FROM up_all), 0),
    'completed_count',    COALESCE((SELECT count(*) FROM up_completed), 0),
    'pending_excluded_count', COALESCE((SELECT count(*) FROM up_pending), 0),
    'kwd_completed_count',    COALESCE((SELECT count(*) FROM up_completed_kwd), 0),
    'strict_verified_rows',   COALESCE((SELECT count(*) FROM up_strict_verified), 0),
    'strict_verified_users',  COALESCE((SELECT count(*) FROM per_user_up WHERE credit_fils > 0), 0),
    'strict_verified_total_capped_fils', COALESCE((SELECT SUM(credit_fils)::bigint FROM per_user_up), 0),
    'negative_linked_review_rows', COALESCE((SELECT count(*) FROM up_neg_review), 0),
    'unlinked_review_rows',        COALESCE((SELECT count(*) FROM up_unlinked_review), 0),
    'duplicate_provider_reference_groups', (
      SELECT count(*) FROM (SELECT COALESCE(upayments_invoice_id, upayments_track_id) AS ref
        FROM up_all WHERE COALESCE(upayments_invoice_id, upayments_track_id) IS NOT NULL
        GROUP BY 1 HAVING count(*) > 1) d)
  ) INTO v_tx_upay;

  -- Proposed entitlements (unchanged)
  WITH s AS (
    SELECT us.user_id,
           lower(COALESCE(pl.tier,'unknown')) AS tier,
           COALESCE(pl.is_lifetime,false)     AS is_lifetime,
           lower(COALESCE(us.status,''))      AS status,
           us.start_date, us.end_date
      FROM public.user_subscriptions us
      LEFT JOIN public.subscription_plans pl ON pl.id = us.plan_id
  ),
  active AS (SELECT * FROM s WHERE status IN ('active','completed','paid','succeeded')
              AND (end_date IS NULL OR end_date >= now())),
  expired AS (SELECT * FROM s WHERE end_date IS NOT NULL AND end_date < now()),
  proposed AS (
    SELECT user_id, 'library'::text AS scope, NULL::text AS collection_key,
           'subs_active_lifetime'::text AS source, 'active'::text AS state FROM active WHERE is_lifetime
    UNION SELECT user_id, 'collection', 'chatgpt_prompts',   'subs_active_basic',    'active'  FROM active  WHERE NOT is_lifetime AND tier='basic'
    UNION SELECT user_id, 'collection', 'chatgpt_prompts',   'subs_active_standard', 'active'  FROM active  WHERE NOT is_lifetime AND tier='standard'
    UNION SELECT user_id, 'collection', 'midjourney_prompts','subs_active_standard', 'active'  FROM active  WHERE NOT is_lifetime AND tier='standard'
    UNION SELECT user_id, 'collection', 'chatgpt_prompts',   'subs_expired_basic',   'expired' FROM expired WHERE NOT is_lifetime AND tier='basic'
    UNION SELECT user_id, 'collection', 'chatgpt_prompts',   'subs_expired_standard','expired' FROM expired WHERE NOT is_lifetime AND tier='standard'
    UNION SELECT user_id, 'collection', 'midjourney_prompts','subs_expired_standard','expired' FROM expired WHERE NOT is_lifetime AND tier='standard'
  ),
  cancelled_lifetime AS (SELECT DISTINCT user_id FROM s
    WHERE is_lifetime AND status NOT IN ('active','completed','paid','succeeded'))
  SELECT jsonb_build_object(
    'by_scope', COALESCE((SELECT jsonb_object_agg(scope, cnt) FROM
      (SELECT scope, count(*) AS cnt FROM proposed GROUP BY scope) z), '{}'::jsonb),
    'by_collection_key_active', COALESCE((SELECT jsonb_object_agg(collection_key, cnt) FROM
      (SELECT collection_key, count(*) AS cnt FROM proposed WHERE scope='collection' AND state='active' GROUP BY collection_key) z), '{}'::jsonb),
    'by_collection_key_expired', COALESCE((SELECT jsonb_object_agg(collection_key, cnt) FROM
      (SELECT collection_key, count(*) AS cnt FROM proposed WHERE scope='collection' AND state='expired' GROUP BY collection_key) z), '{}'::jsonb),
    'active_total',   (SELECT count(*) FROM proposed WHERE state='active'),
    'expired_total',  (SELECT count(*) FROM proposed WHERE state='expired'),
    'unique_users_active',  (SELECT count(DISTINCT user_id) FROM proposed WHERE state='active'),
    'unique_users_expired', (SELECT count(DISTINCT user_id) FROM proposed WHERE state='expired'),
    'cancelled_lifetime_flagged_users', (SELECT count(*) FROM cancelled_lifetime),
    'by_source', COALESCE((SELECT jsonb_object_agg(source, cnt) FROM
      (SELECT source, count(*) AS cnt FROM proposed GROUP BY source) z), '{}'::jsonb)
  ) INTO v_ents;

  -- Proposed lifetime credit — PayPal strict verified only (preserved)
  WITH pp_pos AS (
    SELECT t.* FROM public.transactions t
     WHERE lower(COALESCE(t.payment_gateway,''))='paypal'
       AND lower(COALESCE(t.status,'')) IN ('completed','captured','success','paid')
       AND COALESCE(t.amount_usd,0) > 0),
  pp_verified AS (
    SELECT p.* FROM pp_pos p
     WHERE EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.transaction_id=p.id
                    AND lower(COALESCE(us.status,'')) IN ('active','completed','paid','succeeded'))
       AND NOT EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.transaction_id=p.id
                    AND lower(COALESCE(us.status,'')) IN ('cancelled','canceled','refunded','revoked','chargeback','charged_back'))
       AND p.user_id IS NOT NULL),
  pp_paid AS (SELECT user_id, LEAST(SUM(ROUND(COALESCE(amount_usd,0)*v_rate))::bigint, v_threshold)::bigint AS credit_fils
                FROM pp_verified GROUP BY user_id)
  SELECT jsonb_build_object(
    'source', 'strict verified PayPal only; ROUND(amount * 307.55); per-user cap 30,000 fils',
    'users_with_credit', COALESCE((SELECT count(*) FROM pp_paid WHERE credit_fils > 0),0),
    'total_credit_fils', COALESCE((SELECT SUM(credit_fils)::bigint FROM pp_paid),0),
    'users_capped_at_threshold', COALESCE((SELECT count(*) FROM pp_paid WHERE credit_fils >= v_threshold),0),
    'threshold_fils', v_threshold,
    'conversion_rate_fils_per_usd', v_rate
  ) INTO v_credits;

  -- Combined verified legacy credit (PayPal + UPayments, per-user capped)
  WITH pp_pos AS (
    SELECT t.* FROM public.transactions t
     WHERE lower(COALESCE(t.payment_gateway,''))='paypal'
       AND lower(COALESCE(t.status,'')) IN ('completed','captured','success','paid')
       AND COALESCE(t.amount_usd,0) > 0),
  pp_verified AS (
    SELECT p.* FROM pp_pos p
     WHERE EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.transaction_id=p.id
                    AND lower(COALESCE(us.status,'')) IN ('active','completed','paid','succeeded'))
       AND NOT EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.transaction_id=p.id
                    AND lower(COALESCE(us.status,'')) IN ('cancelled','canceled','refunded','revoked','chargeback','charged_back'))
       AND p.user_id IS NOT NULL),
  per_user_pp AS (SELECT user_id, SUM(ROUND(COALESCE(amount_usd,0)*v_rate))::bigint AS raw_fils
                    FROM pp_verified GROUP BY user_id),
  up_all AS (
    SELECT t.* FROM public.transactions t
     WHERE lower(COALESCE(t.payment_gateway,'')) = 'upayments'
        OR t.upayments_invoice_id IS NOT NULL
        OR t.upayments_track_id IS NOT NULL),
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
      FROM up_all u),
  up_verified AS (
    SELECT c.*,
      CASE c.linked_tier WHEN 'basic' THEN 15000 WHEN 'standard' THEN 20000
                         WHEN 'premium' THEN 25000 WHEN 'ultimate' THEN 30000 END AS base_fils
      FROM up_class c
     WHERE lower(COALESCE(c.status,'')) IN ('completed','captured','success','paid')
       AND upper(COALESCE(c.currency,'')) = 'KWD'
       AND COALESCE(c.amount_usd,0) > 0
       AND c.linked_tier IN ('basic','standard','premium','ultimate')
       AND COALESCE(c.linked_plan_price_usd,0) > 0
       AND (c.amount_usd/c.linked_plan_price_usd) > 0
       AND (c.amount_usd/c.linked_plan_price_usd) <= 1
       AND c.any_link AND NOT c.has_neg_link
       AND c.user_id IS NOT NULL),
  per_user_up AS (SELECT user_id, SUM(ROUND(base_fils * amount_usd / linked_plan_price_usd))::bigint AS raw_fils
                    FROM up_verified GROUP BY user_id),
  per_user_combined AS (
    SELECT COALESCE(a.user_id, b.user_id) AS user_id,
           LEAST(COALESCE(a.raw_fils,0) + COALESCE(b.raw_fils,0), v_threshold)::bigint AS credit_fils
      FROM per_user_pp a FULL OUTER JOIN per_user_up b ON a.user_id = b.user_id
  )
  SELECT jsonb_build_object(
    'source', 'strict verified PayPal + code-reconstructed KWD UPayments; per-user cap 30,000 fils',
    'users_with_credit',         COALESCE((SELECT count(*) FROM per_user_combined WHERE credit_fils > 0),0),
    'total_credit_fils',         COALESCE((SELECT SUM(credit_fils)::bigint FROM per_user_combined),0),
    'users_capped_at_threshold', COALESCE((SELECT count(*) FROM per_user_combined WHERE credit_fils >= v_threshold),0),
    'threshold_fils',            v_threshold
  ) INTO v_combined;

  -- Anomalies (unchanged with review buckets)
  SELECT jsonb_build_object(
    'missing_auth_users_for_subscriptions', (
      SELECT count(*) FROM public.user_subscriptions us
       WHERE us.user_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = us.user_id)),
    'missing_auth_users_for_transactions', (
      SELECT count(*) FROM public.transactions t
       WHERE t.user_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.user_id)),
    'transactions_without_subscription', (SELECT count(*) FROM public.transactions t
       WHERE NOT EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.transaction_id = t.id)),
    'subscriptions_without_transaction', (SELECT count(*) FROM public.user_subscriptions WHERE transaction_id IS NULL),
    'subscriptions_with_missing_transaction', (SELECT count(*) FROM public.user_subscriptions us
       WHERE us.transaction_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = us.transaction_id)),
    'subscriptions_without_plan', (SELECT count(*) FROM public.user_subscriptions WHERE plan_id IS NULL),
    'duplicate_paypal_reference_groups', (SELECT count(*) FROM (
      SELECT COALESCE(paypal_order_id, paypal_payment_id) AS ref FROM public.transactions
       WHERE lower(COALESCE(payment_gateway,''))='paypal' AND COALESCE(paypal_order_id, paypal_payment_id) IS NOT NULL
       GROUP BY 1 HAVING count(*)>1) d),
    'duplicate_upayments_reference_groups', (SELECT count(*) FROM (
      SELECT COALESCE(upayments_invoice_id, upayments_track_id) AS ref FROM public.transactions
       WHERE COALESCE(upayments_invoice_id, upayments_track_id) IS NOT NULL
       GROUP BY 1 HAVING count(*)>1) d),
    'zero_amount_paypal_completed', (SELECT count(*) FROM public.transactions
       WHERE lower(COALESCE(payment_gateway,''))='paypal' AND status IN ('completed','captured','success','paid') AND COALESCE(amount_usd,0)=0),
    'zero_amount_upayments_completed', (SELECT count(*) FROM public.transactions
       WHERE (lower(COALESCE(payment_gateway,''))='upayments' OR upayments_invoice_id IS NOT NULL OR upayments_track_id IS NOT NULL)
         AND status IN ('completed','captured','success','paid') AND COALESCE(amount_usd,0)=0),
    'unsupported_currencies', (SELECT count(*) FROM public.transactions
       WHERE currency IS NOT NULL AND upper(currency) NOT IN ('USD','KWD')),
    'unsupported_gateways', (SELECT count(*) FROM public.transactions
       WHERE payment_gateway IS NOT NULL AND lower(payment_gateway) NOT IN ('paypal','upayments')),
    'transactions_status_mismatch_completed_zero', (SELECT count(*) FROM public.transactions
       WHERE status IN ('completed','captured','success','paid') AND COALESCE(amount_usd,0)=0),
    'subscriptions_expired_but_status_active', (SELECT count(*) FROM public.user_subscriptions
       WHERE lower(COALESCE(status,''))='active' AND end_date IS NOT NULL AND end_date < now()),
    'cancelled_lifetime_users', (SELECT count(DISTINCT us.user_id)
       FROM public.user_subscriptions us LEFT JOIN public.subscription_plans pl ON pl.id = us.plan_id
       WHERE COALESCE(pl.is_lifetime,false)=true
         AND lower(COALESCE(us.status,'')) NOT IN ('active','completed','paid','succeeded')),
    'ambiguous_upayments_amount_rows', 0,
    'paypal_unlinked_positive_completed_review_rows', (SELECT count(*) FROM public.transactions t
       WHERE lower(COALESCE(t.payment_gateway,''))='paypal'
         AND lower(COALESCE(t.status,'')) IN ('completed','captured','success','paid') AND COALESCE(t.amount_usd,0)>0
         AND NOT EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.transaction_id = t.id)),
    'paypal_negative_linked_review_rows', (SELECT count(*) FROM public.transactions t
       WHERE lower(COALESCE(t.payment_gateway,''))='paypal'
         AND lower(COALESCE(t.status,'')) IN ('completed','captured','success','paid') AND COALESCE(t.amount_usd,0)>0
         AND EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.transaction_id = t.id
                      AND lower(COALESCE(us.status,'')) IN ('cancelled','canceled','refunded','revoked','chargeback','charged_back'))),
    'unmatched_legacy_prompts', (SELECT count(*) FROM public.prompts p
       WHERE NOT EXISTS (SELECT 1 FROM public.resources r WHERE r.legacy_prompt_id = p.id))
  ) INTO v_anomalies;

  v_contract := jsonb_build_object(
    'note', 'Final migration grant contract (deferred; no callable execute RPC exists).',
    'rules', jsonb_build_array(
      jsonb_build_object('rule','expired_predecessor_close',
        'detail','Before inserting a new active grant, revoke or reuse any expired-but-unrevoked predecessor for the same (user_id, scope, resource_id-or-collection_key).'),
      jsonb_build_object('rule','concurrent_duplicate_prevention',
        'detail','Partial unique indexes prevent concurrent duplicate active collection/library grants; new legacy-source index blocks replay of the same legacy source per (user_id, scope, collection_key, resource_id).'),
      jsonb_build_object('rule','legacy_transaction_idempotency',
        'detail','lifetime_credit_entries.legacy_transaction_id partial unique index ensures each legacy transaction backs at most one credit entry.'),
      jsonb_build_object('rule','no_execute_rpc',
        'detail','No callable v2_admin_execute_migration exists.')
    )
  );

  v_legacy_plans := jsonb_build_array(
    jsonb_build_object('plan','basic','price_usd',55,'duration','365_days','is_lifetime',false,
      'original_promise','ChatGPT prompts only; explicit 1-year access',
      'proposed_v2_scope','collection:chatgpt_prompts',
      'expiry_treatment','preserve original end_date; expired end_date => historical only'),
    jsonb_build_object('plan','standard','price_usd',65,'duration','365_days','is_lifetime',false,
      'original_promise','ChatGPT + Midjourney prompts; explicit 1-year access',
      'proposed_v2_scope','collection:chatgpt_prompts + collection:midjourney_prompts',
      'expiry_treatment','preserve original end_date; expired end_date => historical only'),
    jsonb_build_object('plan','premium','price_usd',80,'duration','lifetime','is_lifetime',true,
      'original_promise','ChatGPT, Midjourney, n8n, all future categories; lifetime',
      'proposed_v2_scope','library (all current & future Jojo-owned digital resources)',
      'expiry_treatment','no expiry; cancelled => manual review'),
    jsonb_build_object('plan','ultimate','price_usd',100,'duration','lifetime','is_lifetime',true,
      'original_promise','Full lifetime scope + historical special-request benefit',
      'proposed_v2_scope','library (all current & future Jojo-owned digital resources)',
      'expiry_treatment','no expiry; cancelled => manual review')
  );

  v_policy := jsonb_build_object(
    'version','6B.1-r1',
    'lifetime_threshold_fils', v_threshold,
    'lifetime_threshold_kwd', 30,
    'conversion_rate_fils_per_usd', v_rate,
    'library_scope_includes', jsonb_build_array(
      'jojo_skills','jojo_automations','jojo_prompts','jojo_image_styles','jojo_bundles',
      'all_future_jojo_owned_digital_resources','all_future_updates_to_included_resources'),
    'library_scope_excludes', jsonb_build_array(
      'creator_products','api_or_ai_credits','cloud_execution_costs',
      'third_party_licenses','consulting_or_custom_work','other_recurring_cost_services'),
    'active_definition','status in (active, completed, paid, succeeded) AND (end_date IS NULL OR end_date >= now())',
    'expired_definition','end_date IS NOT NULL AND end_date < now(); historical only',
    'cancelled_treatment','no automatic entitlement; per-user manual review only if no valid active grant supersedes',
    'lifetime_credit_rules', jsonb_build_object(
      'paypal_deterministic','Strict verified only: PayPal + completed + amount_usd>0 + at least one linked positive-status subscription + no linked negative-status subscription; ROUND(amount_usd * 307.55) fils; per-user cap 30,000 fils.',
      'upayments_reconstructed','Legacy rows did not persist the provider-returned KWD; inferred fils = ROUND(base_plan_fils * amount_usd / plan.price_usd), where base_plan_fils comes from the historical plan map (basic 15000 / standard 20000 / premium 25000 / ultimate 30000). Requires currency=KWD, completed status, linked positive-status subscription with a known plan (basic/standard/premium/ultimate) with price_usd>0, ratio (amount_usd/price_usd) in (0,1], and no linked negative-status subscription.',
      'upayments_pending_or_review','Pending, refunded, unlinked, negative-linked, unknown-plan, and out-of-range-ratio UPayments rows earn no credit and remain under review.',
      'lifetime_members_ui','Full-lifetime members see lifetime active, not remaining-credit progress.',
      'v2_individual_purchases','Post-migration Jojo-owned V2 purchases add toward the 30 KWD threshold through the main lifetime progress system.',
      'excluded_from_credit','Creator products, external consumption, refunded/negative transactions, unknown-plan UPayments rows.'),
    'no_execute_rpc', true,
    'plans', v_legacy_plans,
    'copy', jsonb_build_object(
      'en', jsonb_build_object(
        'lifetime','Founding Full Library Lifetime — lifetime access to every current and future Jojo-owned digital resource. Excludes creator products, API/AI credits, cloud costs, third-party licenses and custom work.',
        'basic','You had one-year access to the ChatGPT collection.',
        'standard','You had one-year access to the ChatGPT and Midjourney collections.',
        'credit','Verified historical PayPal and code-reconstructed KWD UPayments payments count toward the 30.000 KWD lifetime threshold. Pending, unlinked, refunded and unknown-plan payments stay under review.',
        'cancelled','Cancelled or refunded plans are held for manual review only when no valid active grant already covers the same access.'),
      'ar', jsonb_build_object(
        'lifetime','عضوية المكتبة الكاملة مدى الحياة — وصول دائم لكل موارد جوجو الرقمية الحالية والمستقبلية. لا تشمل منتجات المبدعين أو رصيد الذكاء الاصطناعي أو التكاليف السحابية أو التراخيص الخارجية أو الأعمال المخصصة.',
        'basic','كان لديك وصول لمدة سنة لمجموعة ChatGPT.',
        'standard','كان لديك وصول لمدة سنة لمجموعتي ChatGPT وMidjourney.',
        'credit','مدفوعات PayPal السابقة الموثّقة ومدفوعات UPayments المُعاد حسابها من خريطة الأسعار التاريخية تُحتسب ضمن حد الـ 30.000 دينار. المدفوعات المعلّقة أو غير المرتبطة أو المسترجعة أو ذات الخطة غير المعروفة تبقى قيد المراجعة.',
        'cancelled','الخطط الملغاة أو المسترجعة تُحفظ للمراجعة اليدوية فقط إذا لم يوجد وصول نشط بديل يغطي نفس الحقوق.')
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
    'combined_legacy_credit', v_combined,
    'anomalies', v_anomalies,
    'grant_contract', v_contract,
    'grandfathering_policy', v_policy
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.v2_admin_migration_preview() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.v2_admin_migration_preview() FROM anon;
GRANT  EXECUTE ON FUNCTION public.v2_admin_migration_preview() TO authenticated;

-- =============================================================================
-- 3) Customer self-only summary — expose UPayments reconstructed credit,
--    combined credit, and refine payment_history_under_review to caller-only.
-- =============================================================================
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
  v_pp_credit      bigint := 0;
  v_up_credit      bigint := 0;
  v_combined_credit bigint := 0;
  v_review_pp_unlinked boolean := false;
  v_review_pp_neg      boolean := false;
  v_review_up          boolean := false;
  v_membership_type text;
  v_collections    jsonb := '[]'::jsonb;
  v_manual_review  boolean := false;
  v_lifetime       boolean := false;
  v_expired_hist   boolean := false;
  v_remaining_fils bigint := 0;
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
    max(CASE WHEN NOT pl.is_lifetime AND lower(pl.tier)='basic'
             AND lower(us.status) IN ('active','completed','paid','succeeded') THEN us.end_date END),
    max(CASE WHEN NOT pl.is_lifetime AND lower(pl.tier)='standard'
             AND lower(us.status) IN ('active','completed','paid','succeeded') THEN us.end_date END)
  INTO
    v_has_ultimate, v_has_premium,
    v_has_basic_active, v_has_standard_active,
    v_has_basic_expired, v_has_standard_expired,
    v_has_cancelled_lifetime,
    v_basic_expiry, v_standard_expiry
  FROM public.user_subscriptions us
  LEFT JOIN public.subscription_plans pl ON pl.id = us.plan_id
  WHERE us.user_id = v_uid;

  -- Strict verified PayPal credit for caller (pre-cap sum, then combined cap later).
  SELECT COALESCE(SUM(ROUND(COALESCE(t.amount_usd,0) * v_rate))::bigint, 0)
    INTO v_pp_credit
    FROM public.transactions t
   WHERE t.user_id = v_uid
     AND lower(COALESCE(t.payment_gateway,''))='paypal'
     AND lower(COALESCE(t.status,'')) IN ('completed','captured','success','paid')
     AND COALESCE(t.amount_usd,0) > 0
     AND EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.transaction_id=t.id
                  AND lower(COALESCE(us.status,'')) IN ('active','completed','paid','succeeded'))
     AND NOT EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.transaction_id=t.id
                  AND lower(COALESCE(us.status,'')) IN ('cancelled','canceled','refunded','revoked','chargeback','charged_back'));

  -- Code-reconstructed KWD UPayments credit for caller (pre-cap sum).
  SELECT COALESCE(SUM(ROUND(
      (CASE lower(pl.tier)
         WHEN 'basic' THEN 15000 WHEN 'standard' THEN 20000
         WHEN 'premium' THEN 25000 WHEN 'ultimate' THEN 30000
       END) * t.amount_usd / pl.price_usd
    ))::bigint, 0)
    INTO v_up_credit
    FROM public.transactions t
    JOIN LATERAL (
      SELECT pl.tier, pl.price_usd
        FROM public.user_subscriptions us
        JOIN public.subscription_plans pl ON pl.id = us.plan_id
       WHERE us.transaction_id = t.id
         AND lower(COALESCE(us.status,'')) IN ('active','completed','paid','succeeded')
       LIMIT 1
    ) pl ON true
   WHERE t.user_id = v_uid
     AND (lower(COALESCE(t.payment_gateway,''))='upayments'
          OR t.upayments_invoice_id IS NOT NULL
          OR t.upayments_track_id IS NOT NULL)
     AND lower(COALESCE(t.status,'')) IN ('completed','captured','success','paid')
     AND upper(COALESCE(t.currency,''))='KWD'
     AND COALESCE(t.amount_usd,0) > 0
     AND lower(pl.tier) IN ('basic','standard','premium','ultimate')
     AND COALESCE(pl.price_usd,0) > 0
     AND (t.amount_usd / pl.price_usd) > 0
     AND (t.amount_usd / pl.price_usd) <= 1
     AND NOT EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.transaction_id=t.id
                  AND lower(COALESCE(us.status,'')) IN ('cancelled','canceled','refunded','revoked','chargeback','charged_back'));

  v_combined_credit := LEAST(v_pp_credit + v_up_credit, v_threshold);
  v_pp_credit := LEAST(v_pp_credit, v_threshold);
  v_up_credit := LEAST(v_up_credit, v_threshold);

  -- Caller-only review flags (excluded / review PayPal OR UPayments only).
  SELECT
    EXISTS (SELECT 1 FROM public.transactions t
             WHERE t.user_id = v_uid
               AND lower(COALESCE(t.payment_gateway,''))='paypal'
               AND lower(COALESCE(t.status,'')) IN ('completed','captured','success','paid')
               AND COALESCE(t.amount_usd,0)>0
               AND NOT EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.transaction_id=t.id)),
    EXISTS (SELECT 1 FROM public.transactions t
             WHERE t.user_id = v_uid
               AND lower(COALESCE(t.payment_gateway,''))='paypal'
               AND lower(COALESCE(t.status,'')) IN ('completed','captured','success','paid')
               AND COALESCE(t.amount_usd,0)>0
               AND EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.transaction_id=t.id
                            AND lower(COALESCE(us.status,'')) IN ('cancelled','canceled','refunded','revoked','chargeback','charged_back'))),
    -- UPayments review = any UPayments row that is NOT strict-verified per policy.
    EXISTS (
      SELECT 1 FROM public.transactions t
       WHERE t.user_id = v_uid
         AND (lower(COALESCE(t.payment_gateway,''))='upayments'
              OR t.upayments_invoice_id IS NOT NULL
              OR t.upayments_track_id IS NOT NULL)
         AND NOT (
              lower(COALESCE(t.status,'')) IN ('completed','captured','success','paid')
          AND upper(COALESCE(t.currency,''))='KWD'
          AND COALESCE(t.amount_usd,0) > 0
          AND EXISTS (
                SELECT 1 FROM public.user_subscriptions us
                  JOIN public.subscription_plans pl ON pl.id=us.plan_id
                 WHERE us.transaction_id=t.id
                   AND lower(COALESCE(us.status,'')) IN ('active','completed','paid','succeeded')
                   AND lower(pl.tier) IN ('basic','standard','premium','ultimate')
                   AND COALESCE(pl.price_usd,0) > 0
                   AND (t.amount_usd/pl.price_usd) > 0
                   AND (t.amount_usd/pl.price_usd) <= 1)
          AND NOT EXISTS (
                SELECT 1 FROM public.user_subscriptions us
                 WHERE us.transaction_id=t.id
                   AND lower(COALESCE(us.status,'')) IN ('cancelled','canceled','refunded','revoked','chargeback','charged_back'))
         )
    )
  INTO v_review_pp_unlinked, v_review_pp_neg, v_review_up;

  v_lifetime := (v_has_ultimate OR v_has_premium);

  IF v_has_ultimate THEN v_membership_type := 'ultimate';
  ELSIF v_has_premium THEN v_membership_type := 'premium';
  ELSIF v_has_standard_active THEN v_membership_type := 'standard';
  ELSIF v_has_basic_active THEN v_membership_type := 'basic';
  ELSIF v_has_standard_expired THEN v_membership_type := 'standard_expired';
  ELSIF v_has_basic_expired THEN v_membership_type := 'basic_expired';
  ELSIF v_has_cancelled_lifetime THEN v_membership_type := 'cancelled_lifetime_review';
  ELSE v_membership_type := 'none';
  END IF;

  IF v_lifetime THEN v_collections := jsonb_build_array('library');
  ELSIF v_has_standard_active THEN v_collections := jsonb_build_array('chatgpt_prompts','midjourney_prompts');
  ELSIF v_has_basic_active THEN v_collections := jsonb_build_array('chatgpt_prompts');
  ELSE v_collections := '[]'::jsonb;
  END IF;

  v_expired_hist := (v_has_basic_expired OR v_has_standard_expired)
                    AND NOT v_lifetime AND NOT v_has_standard_active AND NOT v_has_basic_active;
  v_manual_review := v_has_cancelled_lifetime
                     AND NOT v_lifetime AND NOT v_has_standard_active AND NOT v_has_basic_active;

  IF v_lifetime THEN v_remaining_fils := 0;
  ELSE v_remaining_fils := GREATEST(v_threshold - v_combined_credit, 0);
  END IF;

  RETURN jsonb_build_object(
    'membership_type', v_membership_type,
    'lifetime', v_lifetime,
    'included_collection_keys', v_collections,
    'basic_expiry',    v_basic_expiry,
    'standard_expiry', v_standard_expiry,
    'has_expired_historical', v_expired_hist,
    'manual_review_required', v_manual_review,
    'paypal_verified_credit_fils',    v_pp_credit,
    'upayments_verified_credit_fils', v_up_credit,
    'combined_legacy_credit_fils',    v_combined_credit,
    'lifetime_threshold_fils',        v_threshold,
    'remaining_lifetime_fils',        v_remaining_fils,
    'payment_history_under_review', (v_review_pp_unlinked OR v_review_pp_neg OR v_review_up),
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
        WHEN v_membership_type = 'ultimate' THEN 'عضوية المكتبة الكاملة مدى الحياة (ألتيميت) — وصول دائم لكل موارد جوجو الرقمية الحالية والمستقبلية.'
        WHEN v_membership_type = 'premium'  THEN 'عضوية المكتبة الكاملة مدى الحياة (بريميوم) — وصول دائم لكل موارد جوجو الرقمية الحالية والمستقبلية.'
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

-- =============================================================================
-- 4) READ-ONLY rehearsal RPC. No writes, no dynamic SQL, no DDL, no exec.
--    Returns aggregate JSON only. execute_available=false.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.v2_admin_migration_rehearsal()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_rate      numeric := 307.55;
  v_threshold int     := 30000;
  v_result    jsonb;
BEGIN
  PERFORM public._v2_require_admin();

  WITH s AS (
    SELECT us.user_id,
           lower(COALESCE(pl.tier,'unknown'))  AS tier,
           COALESCE(pl.is_lifetime,false)      AS is_lifetime,
           lower(COALESCE(us.status,''))       AS status,
           us.start_date, us.end_date
      FROM public.user_subscriptions us
      LEFT JOIN public.subscription_plans pl ON pl.id = us.plan_id
     WHERE us.user_id IS NOT NULL
  ),
  positive AS (SELECT * FROM s WHERE status IN ('active','completed','paid','succeeded')),
  lifetime_active AS (
    SELECT DISTINCT user_id, tier FROM positive
     WHERE is_lifetime AND (end_date IS NULL OR end_date >= now())
  ),
  lifetime_users AS (SELECT DISTINCT user_id FROM lifetime_active),
  premium_users  AS (SELECT DISTINCT user_id FROM lifetime_active WHERE tier='premium'),
  ultimate_users AS (SELECT DISTINCT user_id FROM lifetime_active WHERE tier='ultimate'),
  basic_active_users AS (
    SELECT DISTINCT user_id FROM positive
     WHERE NOT is_lifetime AND tier='basic' AND (end_date IS NULL OR end_date >= now())
       AND user_id NOT IN (SELECT user_id FROM lifetime_users)),
  standard_active_users AS (
    SELECT DISTINCT user_id FROM positive
     WHERE NOT is_lifetime AND tier='standard' AND (end_date IS NULL OR end_date >= now())
       AND user_id NOT IN (SELECT user_id FROM lifetime_users)),
  -- Precedence: Standard supersedes Basic
  basic_effective AS (
    SELECT user_id FROM basic_active_users
     WHERE user_id NOT IN (SELECT user_id FROM standard_active_users)
  ),
  basic_hist_only AS (
    SELECT DISTINCT user_id FROM positive
     WHERE NOT is_lifetime AND tier='basic' AND end_date IS NOT NULL AND end_date < now()
       AND user_id NOT IN (SELECT user_id FROM lifetime_users)
       AND user_id NOT IN (SELECT user_id FROM basic_active_users)
       AND user_id NOT IN (SELECT user_id FROM standard_active_users)),
  standard_hist_only AS (
    SELECT DISTINCT user_id FROM positive
     WHERE NOT is_lifetime AND tier='standard' AND end_date IS NOT NULL AND end_date < now()
       AND user_id NOT IN (SELECT user_id FROM lifetime_users)
       AND user_id NOT IN (SELECT user_id FROM standard_active_users)),
  cancelled_lifetime_unresolved AS (
    SELECT DISTINCT user_id FROM s
     WHERE is_lifetime AND status NOT IN ('active','completed','paid','succeeded')
       AND user_id NOT IN (SELECT user_id FROM lifetime_users)
  ),
  -- PayPal strict verified pre-cap per user
  pp_pos AS (
    SELECT t.* FROM public.transactions t
     WHERE lower(COALESCE(t.payment_gateway,''))='paypal'
       AND lower(COALESCE(t.status,'')) IN ('completed','captured','success','paid')
       AND COALESCE(t.amount_usd,0)>0),
  pp_verified AS (
    SELECT p.* FROM pp_pos p
     WHERE EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.transaction_id=p.id
                    AND lower(COALESCE(us.status,'')) IN ('active','completed','paid','succeeded'))
       AND NOT EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.transaction_id=p.id
                    AND lower(COALESCE(us.status,'')) IN ('cancelled','canceled','refunded','revoked','chargeback','charged_back'))
       AND p.user_id IS NOT NULL),
  per_user_pp_raw AS (
    SELECT user_id, SUM(ROUND(COALESCE(amount_usd,0)*v_rate))::bigint AS raw_fils
      FROM pp_verified GROUP BY user_id
  ),
  per_user_pp AS (
    SELECT user_id, LEAST(raw_fils, v_threshold)::bigint AS credit_fils FROM per_user_pp_raw
  ),
  -- UPayments code-reconstructed
  up_all AS (
    SELECT t.* FROM public.transactions t
     WHERE lower(COALESCE(t.payment_gateway,''))='upayments'
        OR t.upayments_invoice_id IS NOT NULL
        OR t.upayments_track_id IS NOT NULL),
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
      FROM up_all u),
  up_verified AS (
    SELECT c.*,
      CASE c.linked_tier WHEN 'basic' THEN 15000 WHEN 'standard' THEN 20000
                         WHEN 'premium' THEN 25000 WHEN 'ultimate' THEN 30000 END AS base_fils
      FROM up_class c
     WHERE lower(COALESCE(c.status,'')) IN ('completed','captured','success','paid')
       AND upper(COALESCE(c.currency,''))='KWD'
       AND COALESCE(c.amount_usd,0) > 0
       AND c.linked_tier IN ('basic','standard','premium','ultimate')
       AND COALESCE(c.linked_plan_price_usd,0) > 0
       AND (c.amount_usd/c.linked_plan_price_usd) > 0
       AND (c.amount_usd/c.linked_plan_price_usd) <= 1
       AND c.any_link AND NOT c.has_neg_link
       AND c.user_id IS NOT NULL),
  per_user_up_raw AS (
    SELECT user_id, SUM(ROUND(base_fils * amount_usd / linked_plan_price_usd))::bigint AS raw_fils
      FROM up_verified GROUP BY user_id
  ),
  per_user_up AS (
    SELECT user_id, LEAST(raw_fils, v_threshold)::bigint AS credit_fils FROM per_user_up_raw
  ),
  up_completed AS (SELECT * FROM up_all WHERE lower(COALESCE(status,'')) IN ('completed','captured','success','paid')),
  up_pending   AS (SELECT * FROM up_all WHERE lower(COALESCE(status,'')) NOT IN ('completed','captured','success','paid','refunded','cancelled','canceled','failed','declined','error')),
  up_completed_kwd AS (SELECT * FROM up_completed WHERE upper(COALESCE(currency,''))='KWD' AND COALESCE(amount_usd,0)>0),
  up_neg_review AS (SELECT c.* FROM up_class c WHERE lower(COALESCE(c.status,'')) IN ('completed','captured','success','paid')
                    AND upper(COALESCE(c.currency,''))='KWD' AND COALESCE(c.amount_usd,0)>0 AND c.has_neg_link),
  up_unlinked_review AS (SELECT c.* FROM up_class c WHERE lower(COALESCE(c.status,'')) IN ('completed','captured','success','paid')
                    AND upper(COALESCE(c.currency,''))='KWD' AND COALESCE(c.amount_usd,0)>0 AND NOT c.any_link),
  -- Combined credit
  combined_users AS (
    SELECT COALESCE(a.user_id, b.user_id) AS user_id,
           LEAST(COALESCE(a.raw_fils,0) + COALESCE(b.raw_fils,0), v_threshold)::bigint AS credit_fils
      FROM per_user_pp_raw a FULL OUTER JOIN per_user_up_raw b ON a.user_id=b.user_id
  ),
  threshold_reached AS (SELECT user_id FROM combined_users WHERE credit_fils >= v_threshold),
  threshold_needed AS (
    SELECT user_id FROM threshold_reached
     WHERE user_id NOT IN (SELECT user_id FROM lifetime_users)
  ),
  -- Replay conflicts (should be 0 pre-execution)
  existing_legacy_source_grants AS (
    SELECT count(*) AS n FROM public.entitlements
     WHERE legacy_source IS NOT NULL AND revoked_at IS NULL
  ),
  existing_legacy_tx_credits AS (
    SELECT count(*) AS n FROM public.lifetime_credit_entries
     WHERE legacy_transaction_id IS NOT NULL
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'execute_available', false,
    'notes', 'Read-only rehearsal. No writes performed. No callable execute RPC exists.',
    'policy_version', '6B.1-r1',
    'conversion_rate_fils_per_usd', v_rate,
    'threshold_fils', v_threshold,

    'planned_library_grants', jsonb_build_object(
      'active_premium_users',  (SELECT count(*) FROM premium_users),
      'active_ultimate_users', (SELECT count(*) FROM ultimate_users),
      'unique_active_lifetime_users', (SELECT count(*) FROM lifetime_users)
    ),
    'planned_collection_grants_effective_active', jsonb_build_object(
      'standard_users',    (SELECT count(*) FROM standard_active_users),
      'standard_grants',   ((SELECT count(*) FROM standard_active_users) * 2),
      'basic_users',       (SELECT count(*) FROM basic_effective),
      'basic_grants',      (SELECT count(*) FROM basic_effective),
      'unique_active_collection_users',
        ((SELECT count(*) FROM standard_active_users) + (SELECT count(*) FROM basic_effective))
    ),
    'unique_active_users_total',
      ((SELECT count(*) FROM lifetime_users)
       + (SELECT count(*) FROM standard_active_users)
       + (SELECT count(*) FROM basic_effective)),

    'historical_expired_only', jsonb_build_object(
      'basic_users',    (SELECT count(*) FROM basic_hist_only),
      'standard_users', (SELECT count(*) FROM standard_hist_only),
      'note','historical positive-status expired only; cancelled rows are NOT converted'
    ),
    'cancelled_review', jsonb_build_object(
      'lifetime_unresolved_users', (SELECT count(*) FROM cancelled_lifetime_unresolved)
    ),

    'paypal_verified_credit', jsonb_build_object(
      'users',            (SELECT count(*) FROM per_user_pp WHERE credit_fils > 0),
      'total_capped_fils',(SELECT COALESCE(SUM(credit_fils)::bigint,0) FROM per_user_pp),
      'rows',             (SELECT count(*) FROM pp_verified)
    ),
    'upayments_verified_credit', jsonb_build_object(
      'policy','code-reconstructed KWD from historical plan price map',
      'users',            (SELECT count(*) FROM per_user_up WHERE credit_fils > 0),
      'total_capped_fils',(SELECT COALESCE(SUM(credit_fils)::bigint,0) FROM per_user_up),
      'rows',             (SELECT count(*) FROM up_verified),
      'completed_count',        (SELECT count(*) FROM up_completed),
      'pending_excluded_count', (SELECT count(*) FROM up_pending),
      'kwd_completed_count',    (SELECT count(*) FROM up_completed_kwd),
      'negative_linked_review_rows', (SELECT count(*) FROM up_neg_review),
      'unlinked_review_rows',        (SELECT count(*) FROM up_unlinked_review)
    ),
    'combined_verified_credit', jsonb_build_object(
      'users',            (SELECT count(*) FROM combined_users WHERE credit_fils > 0),
      'total_capped_fils',(SELECT COALESCE(SUM(credit_fils)::bigint,0) FROM combined_users)
    ),
    'threshold', jsonb_build_object(
      'users_reaching_threshold', (SELECT count(*) FROM threshold_reached),
      'users_needing_lifetime_grant_after_excluding_existing_lifetime',
        (SELECT count(*) FROM threshold_needed)
    ),
    'replay_conflicts', jsonb_build_object(
      'existing_active_legacy_source_grants', (SELECT n FROM existing_legacy_source_grants),
      'existing_legacy_transaction_credit_entries', (SELECT n FROM existing_legacy_tx_credits)
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.v2_admin_migration_rehearsal() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.v2_admin_migration_rehearsal() FROM anon;
GRANT  EXECUTE ON FUNCTION public.v2_admin_migration_rehearsal() TO authenticated;
GRANT  EXECUTE ON FUNCTION public.v2_admin_migration_rehearsal() TO service_role;
