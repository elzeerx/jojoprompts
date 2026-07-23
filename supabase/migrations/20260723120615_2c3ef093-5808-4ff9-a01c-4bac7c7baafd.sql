
-- ============================================================
-- Phase 6A.1 quality touch-ups: idempotent skip + reversal_plan
-- ============================================================
CREATE OR REPLACE FUNCTION public.v2_admin_backfill_legacy_prompts(p_dry_run boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_row record;
  v_res_id uuid;
  v_platform_slug text;
  v_type public.v2_resource_type;
  v_tags text[];
  v_slug text;
  v_sku text;
  v_hero text;
  v_existing_res uuid;
  v_ver_id uuid;
  v_compat_id uuid;
  v_product_new_id uuid;
  v_product_upd_ct int;
  v_res_upd_ct int;
  v_inserted int := 0;
  v_updated int := 0;
  v_skipped int := 0;
  v_versions_created int := 0;
  v_compat_created int := 0;
  v_products_created int := 0;
  v_products_updated int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_inserted_ids uuid[] := '{}';
  v_run_id uuid := gen_random_uuid();
BEGIN
  PERFORM public._v2_require_admin();

  FOR v_row IN
    SELECT p.id, p.title, p.title_ar, p.prompt_text, p.prompt_text_ar,
           p.image_path, p.default_image_path, p.prompt_type,
           coalesce(p.metadata,'{}'::jsonb) AS metadata,
           coalesce(p.platform_fields,'{}'::jsonb) AS platform_fields,
           p.created_at, p.platform_id, pl.slug AS platform_slug
      FROM public.prompts p
      LEFT JOIN public.platforms pl ON pl.id = p.platform_id
     ORDER BY p.created_at ASC
  LOOP
    BEGIN
      IF v_row.prompt_type IN ('text','chatgpt-gpt-builder') THEN
        v_type := 'prompt'::public.v2_resource_type;
      ELSIF v_row.prompt_type IN ('image','midjourney-sref','gemini-image') THEN
        v_type := 'image_style'::public.v2_resource_type;
      ELSE
        v_type := 'prompt'::public.v2_resource_type;
      END IF;

      v_platform_slug := COALESCE(
        v_row.platform_slug,
        CASE v_row.prompt_type
          WHEN 'midjourney-sref' THEN 'midjourney'
          WHEN 'gemini-image'    THEN 'gemini'
          WHEN 'chatgpt-gpt-builder' THEN 'gpts-builder'
          ELSE NULL
        END
      );

      SELECT COALESCE(array_agg(elem::text), '{}')::text[] INTO v_tags
        FROM jsonb_array_elements_text(COALESCE(v_row.metadata->'tags','[]'::jsonb)) elem;

      v_hero := COALESCE(v_row.image_path, v_row.default_image_path);
      v_slug := 'legacy-' || substr(replace(v_row.id::text,'-',''), 1, 12);
      v_sku  := 'JOJO-LEGACY-' || upper(substr(replace(v_row.id::text,'-',''), 1, 8));

      SELECT id INTO v_existing_res FROM public.resources WHERE legacy_prompt_id = v_row.id;

      IF v_existing_res IS NULL THEN
        IF p_dry_run THEN
          v_inserted := v_inserted + 1;
          CONTINUE;
        END IF;

        INSERT INTO public.resources (
          slug, type, lifecycle, title_en, title_ar,
          summary_en, description_en, description_ar,
          hero_image_path, category, tags,
          legacy_prompt_id, published_at, created_at, updated_at
        ) VALUES (
          v_slug, v_type, 'published',
          v_row.title,
          NULLIF(btrim(COALESCE(v_row.title_ar,'')),''),
          LEFT(COALESCE(v_row.prompt_text,''),200),
          v_row.prompt_text,
          NULLIF(btrim(COALESCE(v_row.prompt_text_ar,'')),''),
          v_hero,
          v_row.metadata->>'category',
          v_tags,
          v_row.id,
          v_row.created_at,
          v_row.created_at,
          now()
        ) RETURNING id INTO v_res_id;

        v_inserted := v_inserted + 1;
        v_inserted_ids := v_inserted_ids || v_res_id;
      ELSE
        IF p_dry_run THEN
          v_skipped := v_skipped + 1;
          CONTINUE;
        END IF;
        v_res_id := v_existing_res;
        UPDATE public.resources SET
          title_en       = v_row.title,
          title_ar       = NULLIF(btrim(COALESCE(v_row.title_ar,'')),''),
          summary_en     = LEFT(COALESCE(v_row.prompt_text,''),200),
          description_en = v_row.prompt_text,
          description_ar = NULLIF(btrim(COALESCE(v_row.prompt_text_ar,'')),''),
          hero_image_path = COALESCE(hero_image_path, v_hero),
          category       = COALESCE(category, v_row.metadata->>'category'),
          tags           = CASE WHEN array_length(tags,1) IS NULL THEN v_tags ELSE tags END,
          updated_at     = now()
        WHERE id = v_res_id
          AND archived_at IS NULL
          AND (
                title_en       IS DISTINCT FROM v_row.title
             OR title_ar       IS DISTINCT FROM NULLIF(btrim(COALESCE(v_row.title_ar,'')),'')
             OR summary_en     IS DISTINCT FROM LEFT(COALESCE(v_row.prompt_text,''),200)
             OR description_en IS DISTINCT FROM v_row.prompt_text
             OR description_ar IS DISTINCT FROM NULLIF(btrim(COALESCE(v_row.prompt_text_ar,'')),'')
             OR (hero_image_path IS NULL AND v_hero IS NOT NULL)
             OR (category IS NULL AND v_row.metadata->>'category' IS NOT NULL)
             OR (array_length(tags,1) IS NULL AND array_length(v_tags,1) IS NOT NULL)
          );
        GET DIAGNOSTICS v_res_upd_ct = ROW_COUNT;
        IF COALESCE(v_res_upd_ct,0) > 0 THEN
          v_updated := v_updated + 1;
        ELSE
          v_skipped := v_skipped + 1;
        END IF;
      END IF;

      v_ver_id := NULL;
      INSERT INTO public.resource_versions (resource_id, version, major_version, is_current, published_at, changelog_en)
      VALUES (v_res_id, '1.0.0', 1, true, v_row.created_at, 'Legacy import v1')
      ON CONFLICT (resource_id, version) DO NOTHING
      RETURNING id INTO v_ver_id;
      IF v_ver_id IS NOT NULL THEN
        v_versions_created := v_versions_created + 1;
        UPDATE public.resources SET current_version_id = v_ver_id
         WHERE id = v_res_id AND current_version_id IS NULL;
      END IF;

      IF v_platform_slug IS NOT NULL THEN
        v_compat_id := NULL;
        INSERT INTO public.platform_compatibility (resource_id, platform_slug, is_verified, notes_en)
        VALUES (v_res_id, v_platform_slug, false, 'Imported from legacy prompt')
        ON CONFLICT (resource_id, platform_slug) DO NOTHING
        RETURNING id INTO v_compat_id;
        IF v_compat_id IS NOT NULL THEN
          v_compat_created := v_compat_created + 1;
        END IF;
      END IF;

      v_product_new_id := NULL;
      INSERT INTO public.products (sku, product_type, resource_id, title_en, title_ar, price_fils, currency, is_active)
      VALUES (v_sku, 'individual', v_res_id, v_row.title,
              NULLIF(btrim(COALESCE(v_row.title_ar,'')),''), 900, 'KWD', true)
      ON CONFLICT (sku) DO NOTHING
      RETURNING id INTO v_product_new_id;
      IF v_product_new_id IS NOT NULL THEN
        v_products_created := v_products_created + 1;
      ELSE
        UPDATE public.products
           SET title_en    = v_row.title,
               title_ar    = NULLIF(btrim(COALESCE(v_row.title_ar,'')),''),
               resource_id = v_res_id,
               is_active   = true,
               updated_at  = now()
         WHERE sku = v_sku
           AND (title_en <> v_row.title
                OR resource_id IS DISTINCT FROM v_res_id
                OR is_active = false);
        GET DIAGNOSTICS v_product_upd_ct = ROW_COUNT;
        v_products_updated := v_products_updated + COALESCE(v_product_upd_ct,0);
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object(
        'legacy_prompt_id', v_row.id,
        'title', v_row.title,
        'sqlstate', SQLSTATE,
        'error', SQLERRM
      );
    END;
  END LOOP;

  IF NOT p_dry_run THEN
    INSERT INTO public.activity_events (actor_user_id, actor_type, entity_type, entity_id, action, metadata)
    VALUES (
      v_actor, 'admin', 'v2_backfill_run', NULL, 'v2_legacy_prompts_backfill',
      jsonb_build_object(
        'run_id', v_run_id,
        'inserted', v_inserted,
        'updated', v_updated,
        'skipped', v_skipped,
        'versions_created', v_versions_created,
        'compat_created', v_compat_created,
        'products_created', v_products_created,
        'products_updated', v_products_updated,
        'errors', v_errors,
        'inserted_resource_ids', to_jsonb(v_inserted_ids),
        'reversal_plan', 'Non-destructive: to reverse a specific run, archive (lifecycle=archived) resources whose id is listed in inserted_resource_ids and set is_active=false on products with SKU JOJO-LEGACY-<hex>. Do not hard-delete; historical activity_events rows must be preserved.'
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'run_id', v_run_id,
    'dry_run', p_dry_run,
    'inserted', v_inserted,
    'updated', v_updated,
    'skipped', v_skipped,
    'versions_created', v_versions_created,
    'compat_created', v_compat_created,
    'products_created', v_products_created,
    'products_updated', v_products_updated,
    'errors', v_errors,
    'inserted_resource_ids', to_jsonb(v_inserted_ids)
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.v2_admin_backfill_legacy_prompts(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_admin_backfill_legacy_prompts(boolean) TO authenticated;

-- ============================================================
-- Phase 6A.3 — read-only migration preview
-- ============================================================
CREATE OR REPLACE FUNCTION public.v2_admin_migration_preview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rate numeric := 307.55;   -- 1 USD = 307.55 fils (fixed CBK migration snapshot)
  v_catalog jsonb;
  v_collections jsonb;
  v_unmatched jsonb;
  v_subs jsonb;
  v_tx_paypal jsonb;
  v_tx_upay jsonb;
  v_entitlements jsonb;
  v_credits jsonb;
  v_anomalies jsonb;
  v_blockers text[] := '{}';
BEGIN
  PERFORM public._v2_require_admin();

  -- Catalog reconciliation ---------------------------------------------
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
    'legacy_prompt_count', (SELECT c FROM prompts_c),
    'matched_resource_count', (SELECT c FROM matched),
    'legacy_version_count', (SELECT c FROM versions_c),
    'legacy_product_count', (SELECT c FROM products_c),
    'unmatched_legacy_prompt_count', (SELECT c FROM unmatched_prompts)
  ) INTO v_catalog;

  -- Collection classification ------------------------------------------
  WITH classified AS (
    SELECT r.id, public.v2_resource_collection_key(r.id) AS ck
      FROM public.resources r
     WHERE r.legacy_prompt_id IS NOT NULL
  )
  SELECT jsonb_build_object(
    'chatgpt_prompts', count(*) FILTER (WHERE ck='chatgpt_prompts'),
    'midjourney_prompts', count(*) FILTER (WHERE ck='midjourney_prompts'),
    'unmatched_or_ambiguous', count(*) FILTER (WHERE ck IS NULL)
  ) INTO v_collections FROM classified;

  -- Unmatched sample (id + type only, no PII) --------------------------
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

  -- Legacy subscriptions ------------------------------------------------
  WITH sub_rollup AS (
    SELECT
      COALESCE(pl.tier,'unknown') AS tier,
      COALESCE(pl.is_lifetime,false) AS is_lifetime,
      us.status,
      count(*) AS n,
      count(*) FILTER (WHERE us.end_date IS NOT NULL AND us.end_date < now()) AS expired_n,
      count(*) FILTER (WHERE us.end_date IS NULL OR us.end_date >= now()) AS active_n
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
        CASE WHEN is_lifetime THEN 'library'
             WHEN tier IN ('basic','standard') THEN 'collection'
             ELSE 'collection' END
    )), '[]'::jsonb),
    'total_subscriptions', (SELECT count(*) FROM public.user_subscriptions),
    'distinct_users', (SELECT count(DISTINCT user_id) FROM public.user_subscriptions)
  ) INTO v_subs FROM sub_rollup;

  -- PayPal transactions -------------------------------------------------
  WITH pp AS (
    SELECT t.*, LEAST(GREATEST(FLOOR(COALESCE(t.amount_usd,0) * v_rate),0),30000)::int AS credit_fils
      FROM public.transactions t
     WHERE COALESCE(t.payment_gateway,'paypal') = 'paypal'
        OR COALESCE(t.currency,'USD') = 'USD'
  ),
  by_status AS (
    SELECT status, count(*) AS n,
           SUM(COALESCE(amount_usd,0))::numeric(20,2) AS usd_total,
           SUM(FLOOR(COALESCE(amount_usd,0) * v_rate))::bigint AS fils_total
      FROM pp GROUP BY status
  )
  SELECT jsonb_build_object(
    'conversion_rate_fils_per_usd', v_rate,
    'total_count', (SELECT count(*) FROM pp),
    'by_status', COALESCE((SELECT jsonb_agg(row_to_json(bs)) FROM by_status bs), '[]'::jsonb),
    'proposed_credit_fils_completed', COALESCE((
      SELECT SUM(credit_fils)::bigint FROM pp WHERE status IN ('completed','captured','success','paid')
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
        SELECT COALESCE(paypal_order_id, paypal_payment_id) AS ref, count(*) AS n
          FROM pp WHERE COALESCE(paypal_order_id, paypal_payment_id) IS NOT NULL
         GROUP BY 1 HAVING count(*) > 1
      ) d
    )
  ) INTO v_tx_paypal;

  -- UPayments transactions — display BOTH interpretations --------------
  WITH up AS (
    SELECT t.*
      FROM public.transactions t
     WHERE t.payment_gateway = 'upayments'
        OR t.upayments_invoice_id IS NOT NULL
        OR t.upayments_track_id IS NOT NULL
  ),
  totals AS (
    SELECT
      count(*) AS n,
      count(*) FILTER (WHERE status IN ('completed','captured','success','paid')) AS completed_n,
      SUM(COALESCE(amount_usd,0))::numeric(20,3) AS raw_value_total,
      SUM(FLOOR(COALESCE(amount_usd,0) * 1000))::bigint AS as_kwd_fils_total,
      SUM(FLOOR(COALESCE(amount_usd,0) * v_rate))::bigint AS as_usd_fils_total,
      SUM(FLOOR(COALESCE(amount_usd,0) * 1000)) FILTER (WHERE status IN ('completed','captured','success','paid'))::bigint AS as_kwd_fils_completed,
      SUM(FLOOR(COALESCE(amount_usd,0) * v_rate)) FILTER (WHERE status IN ('completed','captured','success','paid'))::bigint AS as_usd_fils_completed
      FROM up
  )
  SELECT jsonb_build_object(
    'ambiguity_note', 'transactions.amount_usd stores UPayments values whose true currency is unresolved. Column is amount_usd yet declared currency is KWD, and values resemble legacy USD plan prices. Do not choose a policy here — Execute remains BLOCKED.',
    'total_count', COALESCE((SELECT n FROM totals),0),
    'completed_count', COALESCE((SELECT completed_n FROM totals),0),
    'raw_value_total', (SELECT raw_value_total FROM totals),
    'interpretation_A_values_as_KWD', jsonb_build_object(
      'conversion', 'amount * 1000 = fils',
      'total_fils', COALESCE((SELECT as_kwd_fils_total FROM totals),0),
      'completed_fils', COALESCE((SELECT as_kwd_fils_completed FROM totals),0)
    ),
    'interpretation_B_values_as_legacy_USD', jsonb_build_object(
      'conversion', 'amount * 307.55 = fils',
      'total_fils', COALESCE((SELECT as_usd_fils_total FROM totals),0),
      'completed_fils', COALESCE((SELECT as_usd_fils_completed FROM totals),0)
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
    v_blockers := v_blockers || 'upayments_currency_policy_unresolved';
  END IF;

  -- Proposed entitlements roll-up (subscriptions -> scope) -------------
  WITH s AS (
    SELECT us.user_id, COALESCE(pl.is_lifetime,false) AS is_lifetime,
           COALESCE(pl.tier,'unknown') AS tier
      FROM public.user_subscriptions us
      LEFT JOIN public.subscription_plans pl ON pl.id = us.plan_id
     WHERE us.status IN ('active','completed','paid','succeeded')
        OR pl.is_lifetime = true
  )
  SELECT jsonb_build_object(
    'library_users',    (SELECT count(DISTINCT user_id) FROM s WHERE is_lifetime),
    'collection_users', (SELECT count(DISTINCT user_id) FROM s WHERE NOT is_lifetime),
    'estimated_active_entitlements',
      (SELECT count(DISTINCT user_id) FROM s)
  ) INTO v_entitlements;

  -- Proposed lifetime credit roll-up (paid only) -----------------------
  WITH per_user AS (
    SELECT t.user_id,
           LEAST(SUM(FLOOR(COALESCE(t.amount_usd,0) * v_rate)),30000)::int AS credit_fils
      FROM public.transactions t
     WHERE t.status IN ('completed','captured','success','paid')
       AND COALESCE(t.payment_gateway,'paypal') = 'paypal'
     GROUP BY t.user_id
  )
  SELECT jsonb_build_object(
    'users_with_credit', COALESCE((SELECT count(*) FROM per_user WHERE credit_fils > 0),0),
    'total_credit_fils', COALESCE((SELECT SUM(credit_fils) FROM per_user),0),
    'users_capped_at_threshold', COALESCE((SELECT count(*) FROM per_user WHERE credit_fils >= 30000),0),
    'threshold_fils', 30000,
    'conversion_rate_fils_per_usd', v_rate
  ) INTO v_credits;

  -- Anomalies ---------------------------------------------------------
  SELECT jsonb_build_object(
    'zero_amount_paypal_completed', (
      SELECT count(*) FROM public.transactions
       WHERE COALESCE(payment_gateway,'paypal')='paypal'
         AND status IN ('completed','captured','success','paid')
         AND COALESCE(amount_usd,0) = 0
    ),
    'transactions_without_subscription', (
      SELECT count(*) FROM public.transactions t
       WHERE NOT EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.transaction_id = t.id)
    ),
    'subscriptions_without_plan', (
      SELECT count(*) FROM public.user_subscriptions WHERE plan_id IS NULL
    )
  ) INTO v_anomalies;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'conversion_rate_fils_per_usd', v_rate,
    'execute_enabled', false,
    'execution_blockers', to_jsonb(v_blockers),
    'catalog', v_catalog,
    'collections', v_collections,
    'unmatched_sample', v_unmatched,
    'subscriptions', v_subs,
    'transactions_paypal', v_tx_paypal,
    'transactions_upayments', v_tx_upay,
    'proposed_entitlements', v_entitlements,
    'proposed_lifetime_credit', v_credits,
    'anomalies', v_anomalies
  );
END;
$$;
REVOKE ALL ON FUNCTION public.v2_admin_migration_preview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_admin_migration_preview() TO authenticated;
COMMENT ON FUNCTION public.v2_admin_migration_preview() IS
  'Read-only migration preview. Does NOT execute the migration. Uses fixed rate 1 USD = 307.55 fils.';
