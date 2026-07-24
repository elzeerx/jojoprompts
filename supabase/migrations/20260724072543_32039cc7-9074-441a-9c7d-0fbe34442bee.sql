
-- =============================================================================
-- Phase 6B.1 rehearsal hardening (forward-only, READ-ONLY).
-- No writes, no executor, no policy changes. Existing RLS/ACL preserved.
-- =============================================================================

-- 1) Replay-protection index: cover ALL legacy_source entitlements, not just
--    non-revoked. Drop only the newly-added active-only index; recreate with a
--    clear all-history name and the same normalized identity tuple.
DROP INDEX IF EXISTS public.entitlements_legacy_source_active_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS entitlements_legacy_source_all_history_uidx
  ON public.entitlements (
    user_id,
    legacy_source,
    scope,
    COALESCE(collection_key, ''),
    COALESCE(resource_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE legacy_source IS NOT NULL;

-- 2) Rehearsal RPC — count replay conflicts across ALL legacy_source
--    entitlements; tighten cancelled-lifetime detection to explicit negative
--    terminal statuses only. Aggregate-only, read-only.
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
  -- Explicit negative terminal statuses only (no pending/unknown coercion).
  cancelled_lifetime_unresolved AS (
    SELECT DISTINCT user_id FROM s
     WHERE is_lifetime
       AND status IN ('cancelled','canceled','refunded','revoked','chargeback','charged_back')
       AND user_id NOT IN (SELECT user_id FROM lifetime_users)
  ),
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
  -- Replay conflicts: ALL legacy_source entitlements (any revoked_at value).
  existing_legacy_source_grants AS (
    SELECT count(*) AS n FROM public.entitlements
     WHERE legacy_source IS NOT NULL
  ),
  existing_legacy_tx_credits AS (
    SELECT count(*) AS n FROM public.lifetime_credit_entries
     WHERE legacy_transaction_id IS NOT NULL
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'execute_available', false,
    'notes', 'Read-only rehearsal. No writes performed. No callable execute RPC exists.',
    'policy_version', '6B.1-r2',
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
      'lifetime_unresolved_users', (SELECT count(*) FROM cancelled_lifetime_unresolved),
      'negative_statuses', jsonb_build_array('cancelled','canceled','refunded','revoked','chargeback','charged_back')
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
      'existing_legacy_source_grants', (SELECT n FROM existing_legacy_source_grants),
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

-- 3) Restore full Arabic exclusions sentence for Premium/Ultimate lifetime
--    rights. English wording, rights, and all other behavior unchanged.
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
