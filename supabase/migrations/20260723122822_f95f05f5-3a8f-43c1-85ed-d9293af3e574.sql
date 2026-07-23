
-- 1) Fix ambiguous_outcome_users computation in preview RPC (precedence-safe symmetric difference).
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
  v_tx_paypal    jsonb;
  v_tx_upay      jsonb;
  v_ents         jsonb;
  v_credits      jsonb;
  v_anomalies    jsonb;
  v_contract     jsonb;
  v_blockers     text[] := ARRAY[]::text[];
BEGIN
  PERFORM public._v2_require_admin();

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
    'unmatched_or_ambiguous', count(*) FILTER (WHERE ck IS NULL)
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
          WHEN is_lifetime AND status = 'active' THEN 'library'
          WHEN is_lifetime AND status <> 'active' THEN 'no_grant_review'
          WHEN tier IN ('basic','standard') THEN 'collection'
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
     WHERE is_lifetime AND status <> 'active'
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

  WITH pp AS (
    SELECT t.*,
      LEAST(GREATEST(ROUND(COALESCE(t.amount_usd,0) * v_rate)::bigint, 0), v_threshold)::bigint AS credit_fils_row
      FROM public.transactions t
     WHERE lower(COALESCE(t.payment_gateway,'')) = 'paypal'
  ),
  by_status AS (
    SELECT status, count(*) AS n,
           SUM(COALESCE(amount_usd,0))::numeric(20,2) AS usd_total,
           SUM(ROUND(COALESCE(amount_usd,0) * v_rate))::bigint AS fils_total
      FROM pp GROUP BY status
  )
  SELECT jsonb_build_object(
    'classification', 'strict: payment_gateway = ''paypal''',
    'conversion_rate_fils_per_usd', v_rate,
    'rounding', 'ROUND(amount_usd * 307.55) fils per row',
    'per_user_cap_fils', v_threshold,
    'total_count', (SELECT count(*) FROM pp),
    'by_status', COALESCE((SELECT jsonb_agg(row_to_json(bs)) FROM by_status bs), '[]'::jsonb),
    'proposed_credit_fils_completed_precap', COALESCE((
      SELECT SUM(ROUND(COALESCE(amount_usd,0) * v_rate))::bigint FROM pp
       WHERE status IN ('completed','captured','success','paid')
    ), 0),
    'zero_amount_count', (SELECT count(*) FROM pp WHERE COALESCE(amount_usd,0) = 0),
    'missing_subscription_link', (
      SELECT count(*) FROM pp
       WHERE NOT EXISTS (
         SELECT 1 FROM public.user_subscriptions us WHERE us.transaction_id = pp.id
       )
    ),
    'duplicate_provider_reference_groups', (
      SELECT count(*) FROM (
        SELECT COALESCE(paypal_order_id, paypal_payment_id) AS ref
          FROM pp WHERE COALESCE(paypal_order_id, paypal_payment_id) IS NOT NULL
         GROUP BY 1 HAVING count(*) > 1
      ) d
    )
  ) INTO v_tx_paypal;

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
  per_user_pp AS (
    SELECT t.user_id,
           LEAST(SUM(ROUND(COALESCE(t.amount_usd,0) * v_rate))::bigint, v_threshold)::bigint AS credit_fils
      FROM public.transactions t
     WHERE lower(COALESCE(t.payment_gateway,'')) = 'paypal'
       AND t.status IN ('completed','captured','success','paid')
       AND t.user_id IS NOT NULL
     GROUP BY t.user_id
  ),
  per_user_upay_kwd AS (
    SELECT t.user_id,
           LEAST(SUM(ROUND(COALESCE(t.amount_usd,0) * 1000))::bigint, v_threshold)::bigint AS credit_fils
      FROM up_completed t
     WHERE t.user_id IS NOT NULL
     GROUP BY t.user_id
  ),
  per_user_upay_usd AS (
    SELECT t.user_id,
           LEAST(SUM(ROUND(COALESCE(t.amount_usd,0) * v_rate))::bigint, v_threshold)::bigint AS credit_fils
      FROM up_completed t
     WHERE t.user_id IS NOT NULL
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
  -- Precedence-safe outcome comparison: build unified user set with
  -- boolean membership in each interpretation, then count where they differ.
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
    'ambiguity_note', 'transactions.amount_usd stores UPayments values whose true currency is unresolved. Column is amount_usd yet declared currency is KWD, and values resemble legacy USD plan prices. Do not choose a policy here — Execute remains BLOCKED.',
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
      ),0)
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

  WITH pp_paid AS (
    SELECT t.user_id,
           LEAST(SUM(ROUND(COALESCE(t.amount_usd,0) * v_rate))::bigint, v_threshold)::bigint AS credit_fils
      FROM public.transactions t
     WHERE lower(COALESCE(t.payment_gateway,'')) = 'paypal'
       AND t.status IN ('completed','captured','success','paid')
       AND t.user_id IS NOT NULL
     GROUP BY t.user_id
  )
  SELECT jsonb_build_object(
    'source', 'strict PayPal only, ROUND(amount * 307.55), per-user cap 30,000 fils',
    'users_with_credit',        COALESCE((SELECT count(*) FROM pp_paid WHERE credit_fils > 0),0),
    'total_credit_fils',        COALESCE((SELECT SUM(credit_fils)::bigint FROM pp_paid),0),
    'users_capped_at_threshold',COALESCE((SELECT count(*) FROM pp_paid WHERE credit_fils >= v_threshold),0),
    'threshold_fils',           v_threshold,
    'conversion_rate_fils_per_usd', v_rate
  ) INTO v_credits;

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
      SELECT count(*) FROM public.user_subscriptions us
       WHERE us.transaction_id IS NULL
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
       WHERE currency IS NOT NULL
         AND upper(currency) NOT IN ('USD','KWD')
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
         AND lower(COALESCE(us.status,'')) <> 'active'
    ),
    'ambiguous_upayments_amount_rows', (
      SELECT count(*) FROM public.transactions
       WHERE (lower(COALESCE(payment_gateway,''))='upayments'
              OR upayments_invoice_id IS NOT NULL
              OR upayments_track_id IS NOT NULL)
    ),
    'unmatched_legacy_prompts', (
      SELECT count(*) FROM public.prompts p
       WHERE NOT EXISTS (SELECT 1 FROM public.resources r WHERE r.legacy_prompt_id = p.id)
    )
  ) INTO v_anomalies;

  v_contract := jsonb_build_object(
    'note',
      'Final migration grant contract (deferred, no callable execute RPC exists). Documented here so DB rules and preview stay in sync.',
    'rules', jsonb_build_array(
      jsonb_build_object(
        'rule', 'expired_predecessor_close',
        'detail', 'Before inserting a new active resource/collection/library grant for a user, any expired-but-unrevoked predecessor for the same (user_id, scope, resource_id-or-collection_key) MUST be revoked with revoke_reason=''migration_supersede'' OR deterministically reused/extended in place. Partial unique indexes cannot use now(), so this is enforced by the grant contract, not by the index alone.'
      ),
      jsonb_build_object(
        'rule', 'concurrent_duplicate_prevention',
        'detail', 'A partial unique index on (user_id, collection_key) WHERE scope=collection AND revoked_at IS NULL prevents concurrent duplicate active collection grants. Library grants keep the existing per-user/reason unique index.'
      ),
      jsonb_build_object(
        'rule', 'resource_scope_per_user_idempotency',
        'detail', 'Resource-scoped grants are currently unique per (order_id, resource_id) active only. The final migration contract must enforce per (user_id, resource_id, version_major NULLS coalesced) idempotency in code by upserting/reusing the active row rather than duplicating.'
      ),
      jsonb_build_object(
        'rule', 'no_execute_rpc',
        'detail', 'No callable v2_admin_execute_migration function exists. Preview remains read-only until UPayments currency policy is resolved and an execution RPC is separately designed and reviewed.'
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
    'transactions_paypal', v_tx_paypal,
    'transactions_upayments', v_tx_upay,
    'proposed_entitlements', v_ents,
    'proposed_lifetime_credit', v_credits,
    'anomalies', v_anomalies,
    'grant_contract', v_contract
  );
END;
$function$;

-- 2) Tighten one-argument download helper ACL. Frontend does not call this
--    overload; the download Edge Function uses the two-argument overload with
--    p_user_id. Revoke from PUBLIC/anon/authenticated so it is internal only.
REVOKE EXECUTE ON FUNCTION public.authorize_resource_download(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.authorize_resource_download(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.authorize_resource_download(uuid) FROM authenticated;

-- Two-arg overload remains restricted to postgres/service_role (no change).
REVOKE EXECUTE ON FUNCTION public.authorize_resource_download(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.authorize_resource_download(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.authorize_resource_download(uuid, uuid) FROM authenticated;
