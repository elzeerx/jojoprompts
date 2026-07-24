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

  IF v_has_ultimate THEN v_membership_type := 'ultimate';
  ELSIF v_has_premium THEN v_membership_type := 'premium';
  ELSIF v_has_standard_active THEN v_membership_type := 'standard';
  ELSIF v_has_basic_active THEN v_membership_type := 'basic';
  ELSIF v_has_standard_expired THEN v_membership_type := 'standard_expired';
  ELSIF v_has_basic_expired THEN v_membership_type := 'basic_expired';
  ELSIF v_has_cancelled_lifetime THEN v_membership_type := 'cancelled_lifetime_review';
  ELSE v_membership_type := 'none';
  END IF;

  IF v_lifetime THEN
    v_collections := jsonb_build_array('library');
  ELSIF v_has_standard_active THEN
    v_collections := jsonb_build_array('chatgpt_prompts','midjourney_prompts');
  ELSIF v_has_basic_active THEN
    v_collections := jsonb_build_array('chatgpt_prompts');
  ELSE
    v_collections := '[]'::jsonb;
  END IF;

  v_expired_hist := (v_has_basic_expired OR v_has_standard_expired)
                    AND NOT v_lifetime
                    AND NOT v_has_standard_active
                    AND NOT v_has_basic_active;

  v_manual_review := v_has_cancelled_lifetime
                     AND NOT v_lifetime
                     AND NOT v_has_standard_active
                     AND NOT v_has_basic_active;

  -- Corrective: users who already hold an active full-library lifetime grant
  -- (Premium or Ultimate under the approved grandfathering logic) have no
  -- remaining threshold to clear; suppress remaining_lifetime_fils to 0
  -- regardless of any verified historical PayPal credit.
  IF v_lifetime THEN
    v_remaining_fils := 0;
  ELSE
    v_remaining_fils := GREATEST(v_threshold - v_credit_fils, 0);
  END IF;

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
    'remaining_lifetime_fils', v_remaining_fils,
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