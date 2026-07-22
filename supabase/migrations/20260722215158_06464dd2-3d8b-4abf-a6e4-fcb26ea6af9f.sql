
-- =============================================================================
-- Corrective migration: fix admin RPCs to use the ACTUAL v2_* enum type names.
-- Additive only (CREATE OR REPLACE). Does not modify prior migration history.
-- =============================================================================

-- 1) save_admin_resource_draft ------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_admin_resource_draft(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_admin boolean;
  v_resource_id uuid;
  v_res jsonb := coalesce(payload -> 'resource', '{}'::jsonb);
  v_ver jsonb := payload -> 'version';
  v_type text := coalesce(v_res ->> 'type', 'skill');
  v_slug text := coalesce(v_res ->> 'slug', '');
  v_new_resource boolean := (payload ->> 'resource_id') IS NULL;
  v_lifecycle text;
  v_current_version_id uuid;
  v_current_immutable boolean := false;
  v_want_new_version boolean := coalesce((v_ver ->> 'is_new_version')::boolean, false);
  v_version_str text := coalesce(v_ver ->> 'version', '');
  v_changelog text := v_ver ->> 'changelog_en';
  v_new_version_id uuid;
  v_target_version_id uuid;
  v_prod jsonb;
  v_bundle_item uuid;
  v_owning_resource uuid;
  v_sku text;
  v_ptype text;
  v_price int;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  SELECT public.has_role(v_actor, 'admin'::public.app_role) INTO v_admin;
  IF NOT v_admin THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  IF v_type NOT IN ('skill','automation','prompt','prompt_pack','image_style','bundle') THEN
    RAISE EXCEPTION 'invalid_resource_type: %', v_type;
  END IF;

  IF v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'invalid_slug: %', v_slug;
  END IF;

  IF v_new_resource THEN
    INSERT INTO public.resources (
      slug, type, lifecycle, title_en, title_ar,
      summary_en, summary_ar, description_en, description_ar,
      examples_en, examples_ar, limitations_en, limitations_ar,
      uninstall_en, uninstall_ar, support_en, support_ar,
      update_info_en, update_info_ar,
      category, tags, hero_image_path, effort_minutes, owner_id
    ) VALUES (
      v_slug,
      v_type::public.v2_resource_type,
      'draft'::public.v2_resource_lifecycle,
      v_res ->> 'title_en', v_res ->> 'title_ar',
      v_res ->> 'summary_en', v_res ->> 'summary_ar',
      v_res ->> 'description_en', v_res ->> 'description_ar',
      v_res ->> 'examples_en', v_res ->> 'examples_ar',
      v_res ->> 'limitations_en', v_res ->> 'limitations_ar',
      v_res ->> 'uninstall_en', v_res ->> 'uninstall_ar',
      v_res ->> 'support_en', v_res ->> 'support_ar',
      v_res ->> 'update_info_en', v_res ->> 'update_info_ar',
      v_res ->> 'category',
      CASE WHEN v_res ? 'tags' AND jsonb_typeof(v_res -> 'tags') = 'array'
           THEN ARRAY(SELECT jsonb_array_elements_text(v_res -> 'tags'))
           ELSE ARRAY[]::text[] END,
      v_res ->> 'hero_image_path',
      NULLIF(v_res ->> 'effort_minutes','')::int,
      v_actor
    )
    RETURNING id INTO v_resource_id;
  ELSE
    v_resource_id := (payload ->> 'resource_id')::uuid;
    SELECT lifecycle::text, current_version_id
      INTO v_lifecycle, v_current_version_id
    FROM public.resources
    WHERE id = v_resource_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'resource_not_found';
    END IF;

    IF EXISTS (SELECT 1 FROM public.resources WHERE slug = v_slug AND id <> v_resource_id) THEN
      RAISE EXCEPTION 'slug_taken: %', v_slug;
    END IF;

    UPDATE public.resources SET
      slug = v_slug,
      type = v_type::public.v2_resource_type,
      title_en = v_res ->> 'title_en',
      title_ar = v_res ->> 'title_ar',
      summary_en = v_res ->> 'summary_en',
      summary_ar = v_res ->> 'summary_ar',
      description_en = v_res ->> 'description_en',
      description_ar = v_res ->> 'description_ar',
      examples_en    = v_res ->> 'examples_en',
      examples_ar    = v_res ->> 'examples_ar',
      limitations_en = v_res ->> 'limitations_en',
      limitations_ar = v_res ->> 'limitations_ar',
      uninstall_en   = v_res ->> 'uninstall_en',
      uninstall_ar   = v_res ->> 'uninstall_ar',
      support_en     = v_res ->> 'support_en',
      support_ar     = v_res ->> 'support_ar',
      update_info_en = v_res ->> 'update_info_en',
      update_info_ar = v_res ->> 'update_info_ar',
      category = v_res ->> 'category',
      tags = CASE WHEN v_res ? 'tags' AND jsonb_typeof(v_res -> 'tags') = 'array'
                  THEN ARRAY(SELECT jsonb_array_elements_text(v_res -> 'tags'))
                  ELSE tags END,
      hero_image_path = v_res ->> 'hero_image_path',
      effort_minutes = NULLIF(v_res ->> 'effort_minutes','')::int,
      updated_at = now()
    WHERE id = v_resource_id;
  END IF;

  -- Version handling: immutable when version.published_at is set OR resource is published
  IF v_ver IS NOT NULL THEN
    IF length(trim(v_version_str)) = 0 THEN
      RAISE EXCEPTION 'version_required';
    END IF;
    IF v_version_str !~ '^[0-9]+\.[0-9]+\.[0-9]+([.\-+][A-Za-z0-9._-]+)?$' THEN
      RAISE EXCEPTION 'version_invalid_semver: %', v_version_str;
    END IF;

    SELECT lifecycle::text, current_version_id
      INTO v_lifecycle, v_current_version_id
      FROM public.resources WHERE id = v_resource_id FOR UPDATE;

    IF v_current_version_id IS NOT NULL THEN
      SELECT ((published_at IS NOT NULL) OR (v_lifecycle = 'published'))
        INTO v_current_immutable
        FROM public.resource_versions WHERE id = v_current_version_id;
    END IF;

    IF v_want_new_version OR v_current_immutable OR v_current_version_id IS NULL THEN
      IF EXISTS (
        SELECT 1 FROM public.resource_versions
        WHERE resource_id = v_resource_id AND version = v_version_str
      ) THEN
        RAISE EXCEPTION 'version_duplicate: %', v_version_str;
      END IF;

      INSERT INTO public.resource_versions (
        resource_id, version, changelog_en, is_current
      ) VALUES (
        v_resource_id, v_version_str, v_changelog, false
      )
      RETURNING id INTO v_new_version_id;

      IF v_current_version_id IS NOT NULL THEN
        UPDATE public.resource_versions
          SET is_current = false, updated_at = now()
        WHERE id = v_current_version_id;
      END IF;

      UPDATE public.resource_versions
        SET is_current = true, updated_at = now()
      WHERE id = v_new_version_id;

      UPDATE public.resources
        SET current_version_id = v_new_version_id, updated_at = now()
      WHERE id = v_resource_id;

      v_target_version_id := v_new_version_id;
    ELSE
      UPDATE public.resource_versions SET
        version = v_version_str,
        changelog_en = v_changelog,
        updated_at = now()
      WHERE id = v_current_version_id;
      v_target_version_id := v_current_version_id;
    END IF;
  END IF;

  -- Platform compatibility
  IF payload ? 'platform_compatibility' THEN
    DELETE FROM public.platform_compatibility WHERE resource_id = v_resource_id;
    INSERT INTO public.platform_compatibility (
      resource_id, platform_slug, min_version, notes_en, notes_ar, is_verified
    )
    SELECT
      v_resource_id,
      (row ->> 'platform_slug'),
      NULLIF(row ->> 'min_version',''),
      NULLIF(row ->> 'notes_en',''),
      NULLIF(row ->> 'notes_ar',''),
      coalesce((row ->> 'is_verified')::boolean, false)
    FROM jsonb_array_elements(payload -> 'platform_compatibility') row
    WHERE coalesce(row ->> 'platform_slug','') <> '';
  END IF;

  -- Installation guides
  IF payload ? 'installation_guides' THEN
    DELETE FROM public.installation_guides WHERE resource_id = v_resource_id;
    INSERT INTO public.installation_guides (
      resource_id, platform_slug, steps_en, steps_ar, estimated_minutes
    )
    SELECT
      v_resource_id,
      (row ->> 'platform_slug'),
      coalesce(row -> 'steps_en', '[]'::jsonb),
      coalesce(row -> 'steps_ar', '[]'::jsonb),
      NULLIF(row ->> 'estimated_minutes','')::int
    FROM jsonb_array_elements(payload -> 'installation_guides') row
    WHERE coalesce(row ->> 'platform_slug','') <> '';
  END IF;

  -- Permissions (kind is text, no enum cast)
  IF payload ? 'permissions' THEN
    DELETE FROM public.resource_permissions WHERE resource_id = v_resource_id;
    INSERT INTO public.resource_permissions (
      resource_id, kind, key, label_en, is_required, is_public
    )
    SELECT
      v_resource_id,
      row ->> 'kind',
      row ->> 'key',
      NULLIF(row ->> 'label_en',''),
      coalesce((row ->> 'is_required')::boolean, false),
      coalesce((row ->> 'is_public')::boolean, true)
    FROM jsonb_array_elements(payload -> 'permissions') row
    WHERE coalesce(row ->> 'key','') <> '';
  END IF;

  -- License
  IF payload ? 'license' AND (payload -> 'license') IS NOT NULL
     AND coalesce((payload -> 'license') ->> 'license_key','') <> '' THEN
    DELETE FROM public.licenses WHERE resource_id = v_resource_id;
    INSERT INTO public.licenses (
      resource_id, license_key, terms_en, allows_commercial, allows_redistribution
    ) VALUES (
      v_resource_id,
      (payload -> 'license') ->> 'license_key',
      (payload -> 'license') ->> 'terms_en',
      coalesce(((payload -> 'license') ->> 'allows_commercial')::boolean, false),
      coalesce(((payload -> 'license') ->> 'allows_redistribution')::boolean, false)
    );
  END IF;

  -- Products (strict integrity, no per-resource lifetime, SKU ownership)
  IF payload ? 'products' THEN
    FOR v_prod IN SELECT value FROM jsonb_array_elements(payload -> 'products')
    LOOP
      v_sku := coalesce(v_prod ->> 'sku', '');
      v_ptype := coalesce(v_prod ->> 'product_type', '');
      v_price := coalesce((v_prod ->> 'price_fils')::int, 0);

      IF length(trim(v_sku)) = 0 THEN
        RAISE EXCEPTION 'product_sku_required';
      END IF;
      IF coalesce(v_prod ->> 'title_en','') = '' THEN
        RAISE EXCEPTION 'product_title_required: sku=%', v_sku;
      END IF;
      IF v_ptype = 'lifetime' THEN
        RAISE EXCEPTION 'per_resource_lifetime_forbidden: sku=%', v_sku;
      END IF;
      IF v_ptype NOT IN ('free','individual','bundle') THEN
        RAISE EXCEPTION 'product_type_invalid: %', v_ptype;
      END IF;
      IF v_ptype = 'bundle' AND v_type <> 'bundle' THEN
        RAISE EXCEPTION 'bundle_product_only_on_bundle_resource';
      END IF;
      IF v_type = 'bundle' AND v_ptype = 'individual' THEN
        RAISE EXCEPTION 'individual_product_forbidden_on_bundle';
      END IF;
      IF coalesce(v_prod ->> 'currency','KWD') <> 'KWD' THEN
        RAISE EXCEPTION 'currency_must_be_kwd';
      END IF;
      IF v_price < 0 THEN
        RAISE EXCEPTION 'price_negative';
      END IF;
      IF v_ptype = 'free' AND v_price <> 0 THEN
        RAISE EXCEPTION 'free_price_must_be_zero';
      END IF;
      IF v_ptype IN ('individual','bundle') AND v_price <= 0 THEN
        RAISE EXCEPTION 'paid_price_must_be_positive: sku=%', v_sku;
      END IF;

      SELECT resource_id INTO v_owning_resource FROM public.products WHERE sku = v_sku;
      IF v_owning_resource IS NOT NULL AND v_owning_resource <> v_resource_id THEN
        RAISE EXCEPTION 'sku_taken: %', v_sku;
      END IF;
    END LOOP;

    UPDATE public.products
       SET is_active = false, updated_at = now()
     WHERE resource_id = v_resource_id
       AND sku NOT IN (
         SELECT (row ->> 'sku') FROM jsonb_array_elements(payload -> 'products') row
       );

    FOR v_prod IN SELECT value FROM jsonb_array_elements(payload -> 'products')
    LOOP
      v_sku := v_prod ->> 'sku';
      IF EXISTS (SELECT 1 FROM public.products WHERE sku = v_sku AND resource_id = v_resource_id) THEN
        UPDATE public.products SET
          product_type = (v_prod ->> 'product_type')::public.v2_product_type,
          title_en = v_prod ->> 'title_en',
          title_ar = v_prod ->> 'title_ar',
          price_fils = (v_prod ->> 'price_fils')::int,
          currency = 'KWD',
          is_active = true,
          updated_at = now()
        WHERE sku = v_sku AND resource_id = v_resource_id;
      ELSE
        INSERT INTO public.products (
          sku, product_type, resource_id, title_en, title_ar, price_fils, currency, is_active
        ) VALUES (
          v_sku, (v_prod ->> 'product_type')::public.v2_product_type, v_resource_id,
          v_prod ->> 'title_en', v_prod ->> 'title_ar',
          (v_prod ->> 'price_fils')::int, 'KWD', true
        );
      END IF;
    END LOOP;
  END IF;

  -- Bundle items
  IF v_type = 'bundle' AND payload ? 'bundle_items' THEN
    DECLARE
      v_bundle_product_id uuid;
    BEGIN
      SELECT id INTO v_bundle_product_id FROM public.products
       WHERE resource_id = v_resource_id AND product_type = 'bundle' AND is_active = true
       ORDER BY updated_at DESC LIMIT 1;

      IF v_bundle_product_id IS NOT NULL THEN
        DELETE FROM public.product_bundle_items WHERE bundle_product_id = v_bundle_product_id;
        FOR v_bundle_item IN
          SELECT DISTINCT (value #>> '{}')::uuid
          FROM jsonb_array_elements(payload -> 'bundle_items')
        LOOP
          IF v_bundle_item = v_resource_id THEN
            RAISE EXCEPTION 'bundle_self_inclusion';
          END IF;
          INSERT INTO public.product_bundle_items (bundle_product_id, resource_id)
          VALUES (v_bundle_product_id, v_bundle_item)
          ON CONFLICT DO NOTHING;
        END LOOP;
      END IF;
    END;
  END IF;

  -- Transactional activity log (must succeed or the whole save rolls back)
  INSERT INTO public.activity_events (
    actor_user_id, actor_type, entity_type, entity_id, action, metadata
  ) VALUES (
    v_actor, 'admin', 'resource', v_resource_id, 'save_draft',
    jsonb_build_object('slug', v_slug, 'type', v_type)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'resource_id', v_resource_id,
    'slug', v_slug,
    'current_version_id', v_target_version_id
  );
END;
$fn$;

-- 2) admin_publish_resource ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_publish_resource(p_resource_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_admin boolean;
  v_r RECORD;
  v_errs text[] := ARRAY[]::text[];
  v_active_products int;
  v_positive_bundle_products int;
  v_has_bad_lifetime boolean;
  v_scan_status text;
BEGIN
  SELECT public.has_role(v_actor, 'admin'::public.app_role) INTO v_admin;
  IF NOT v_admin THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_r FROM public.resources WHERE id = p_resource_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'errors', ARRAY['resource_not_found']);
  END IF;

  IF coalesce(v_r.title_en,'') = '' THEN v_errs := v_errs || 'missing_title_en'; END IF;
  IF coalesce(v_r.summary_en,'') = '' THEN v_errs := v_errs || 'missing_summary_en'; END IF;
  IF coalesce(v_r.description_en,'') = '' THEN v_errs := v_errs || 'missing_description_en'; END IF;
  IF v_r.current_version_id IS NULL THEN v_errs := v_errs || 'no_current_version'; END IF;

  IF v_r.type IN ('skill','automation') THEN
    IF NOT EXISTS (SELECT 1 FROM public.platform_compatibility WHERE resource_id = p_resource_id) THEN
      v_errs := v_errs || 'missing_platform_compatibility';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.installation_guides WHERE resource_id = p_resource_id) THEN
      v_errs := v_errs || 'missing_installation_guide';
    END IF;
    IF v_r.current_version_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.resource_files WHERE resource_version_id = v_r.current_version_id) THEN
        v_errs := v_errs || 'no_package_files';
      ELSE
        SELECT status::text INTO v_scan_status
          FROM public.package_scans
         WHERE resource_version_id = v_r.current_version_id
         ORDER BY created_at DESC, scanned_at DESC NULLS LAST
         LIMIT 1;
        IF v_scan_status IS NULL THEN
          v_errs := v_errs || 'scan_missing';
        ELSIF v_scan_status <> 'clean' THEN
          v_errs := v_errs || ('scan_not_clean:' || v_scan_status);
        END IF;
      END IF;
    END IF;
  END IF;

  SELECT
    count(*) FILTER (WHERE is_active),
    bool_or(product_type::text = 'lifetime')
  INTO v_active_products, v_has_bad_lifetime
  FROM public.products WHERE resource_id = p_resource_id;

  IF v_has_bad_lifetime THEN v_errs := v_errs || 'legacy_lifetime_product_present'; END IF;
  IF coalesce(v_active_products,0) = 0 THEN v_errs := v_errs || 'no_active_product'; END IF;

  IF v_r.type = 'bundle' THEN
    SELECT count(*) INTO v_positive_bundle_products
      FROM public.products
     WHERE resource_id = p_resource_id
       AND product_type = 'bundle'::public.v2_product_type
       AND is_active AND price_fils > 0;
    IF coalesce(v_positive_bundle_products,0) = 0 THEN
      v_errs := v_errs || 'bundle_requires_positive_bundle_product';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.product_bundle_items pbi
                   JOIN public.products p ON p.id = pbi.bundle_product_id
                   WHERE p.resource_id = p_resource_id) THEN
      v_errs := v_errs || 'bundle_empty';
    END IF;
  END IF;

  IF array_length(v_errs, 1) IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'errors', v_errs);
  END IF;

  UPDATE public.resources
     SET lifecycle = 'published'::public.v2_resource_lifecycle,
         published_at = coalesce(published_at, now()),
         archived_at = NULL,
         updated_at = now()
   WHERE id = p_resource_id;

  UPDATE public.resource_versions
     SET published_at = coalesce(published_at, now()), updated_at = now()
   WHERE id = v_r.current_version_id;

  -- Transactional audit
  INSERT INTO public.activity_events (
    actor_user_id, actor_type, entity_type, entity_id, action, metadata
  ) VALUES (
    v_actor, 'admin', 'resource', p_resource_id, 'publish',
    jsonb_build_object('version_id', v_r.current_version_id)
  );

  RETURN jsonb_build_object('ok', true, 'resource_id', p_resource_id);
END;
$fn$;

-- 3) admin_transition_resource_lifecycle --------------------------------------
CREATE OR REPLACE FUNCTION public.admin_transition_resource_lifecycle(
  p_resource_id uuid, p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_admin boolean;
  v_new_lifecycle text;
  v_updated int;
BEGIN
  SELECT public.has_role(v_actor, 'admin'::public.app_role) INTO v_admin;
  IF NOT v_admin THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  CASE p_action
    WHEN 'review'  THEN v_new_lifecycle := 'review';
    WHEN 'archive' THEN v_new_lifecycle := 'archived';
    WHEN 'restore' THEN v_new_lifecycle := 'draft';
    ELSE RAISE EXCEPTION 'unknown_action: %', p_action;
  END CASE;

  UPDATE public.resources
     SET lifecycle = v_new_lifecycle::public.v2_resource_lifecycle,
         archived_at = CASE WHEN v_new_lifecycle='archived' THEN now() ELSE NULL END,
         updated_at = now()
   WHERE id = p_resource_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- Transactional audit
  INSERT INTO public.activity_events (
    actor_user_id, actor_type, entity_type, entity_id, action, metadata
  ) VALUES (
    v_actor, 'admin', 'resource', p_resource_id, 'lifecycle_' || p_action, '{}'::jsonb
  );

  RETURN jsonb_build_object('ok', true);
END;
$fn$;

-- 4) get_admin_v2_overview ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_v2_overview(p_period_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_admin boolean;
  v_since timestamptz := now() - make_interval(days => greatest(1, p_period_days));
  v_revenue_fils bigint;
  v_paid_orders int;
  v_failed_orders_period int;
  v_active_entitlements int;
  v_lifetime_purchases int;
  v_lifetime_threshold int;
  v_success_count int;
  v_failure_count int;
  v_success_rate numeric;
  v_refund_count int;
  v_refund_denominator int;
  v_refund_rate numeric;
  v_total_resources int;
  v_published_resources int;
  v_drafts int;
  v_review int;
  v_scans int;
  v_failed_payments int;
  v_pending_refunds int;
  v_open_reports int;
BEGIN
  SELECT public.has_role(v_actor, 'admin'::public.app_role) INTO v_admin;
  IF NOT v_admin THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(sum(paid_fils),0), count(*)
    INTO v_revenue_fils, v_paid_orders
  FROM public.orders
  WHERE status = 'paid'::public.v2_order_status AND settled_at >= v_since;

  SELECT count(*) INTO v_failed_orders_period
  FROM public.orders WHERE status = 'failed'::public.v2_order_status AND updated_at >= v_since;

  SELECT count(*) INTO v_active_entitlements
  FROM public.entitlements
  WHERE revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());

  -- Restrict lifetime counters to ACTIVE grants (not revoked, not expired)
  SELECT
    count(*) FILTER (WHERE grant_reason = 'lifetime_purchase'::public.v2_grant_reason),
    count(*) FILTER (WHERE grant_reason = 'lifetime_threshold'::public.v2_grant_reason)
  INTO v_lifetime_purchases, v_lifetime_threshold
  FROM public.entitlements
  WHERE scope = 'library'::public.v2_entitlement_scope
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());

  WITH latest AS (
    SELECT DISTINCT ON (order_id)
      order_id, event_type
    FROM public.payment_events
    WHERE order_id IS NOT NULL
      AND received_at >= v_since
      AND event_type::text IN ('captured','failed','refunded','chargeback','reversal')
    ORDER BY order_id, received_at DESC
  )
  SELECT
    count(*) FILTER (WHERE event_type::text = 'captured'),
    count(*) FILTER (WHERE event_type::text = 'failed')
  INTO v_success_count, v_failure_count
  FROM latest;

  IF (v_success_count + v_failure_count) > 0 THEN
    v_success_rate := round(100.0 * v_success_count / (v_success_count + v_failure_count), 1);
  END IF;

  -- Refunds: 'processed' == completed. Denominator is paid orders in the period.
  SELECT count(*) INTO v_refund_count FROM public.refunds
   WHERE status = 'processed'::public.v2_refund_status
     AND coalesce(processed_at, updated_at) >= v_since;
  v_refund_denominator := v_paid_orders;
  IF v_refund_denominator > 0 THEN
    v_refund_rate := round(100.0 * v_refund_count / v_refund_denominator, 1);
  END IF;

  SELECT count(*), count(*) FILTER (WHERE lifecycle = 'published'::public.v2_resource_lifecycle)
    INTO v_total_resources, v_published_resources FROM public.resources;

  SELECT count(*) FILTER (WHERE lifecycle = 'draft'::public.v2_resource_lifecycle),
         count(*) FILTER (WHERE lifecycle = 'review'::public.v2_resource_lifecycle)
    INTO v_drafts, v_review FROM public.resources;

  -- Attention: skill/automation current versions with files whose latest scan is not clean
  SELECT count(DISTINCT r.id) INTO v_scans
  FROM public.resources r
  JOIN public.resource_versions rv ON rv.id = r.current_version_id
  LEFT JOIN LATERAL (
    SELECT status::text AS s
      FROM public.package_scans ps
     WHERE ps.resource_version_id = rv.id
     ORDER BY ps.created_at DESC, ps.scanned_at DESC NULLS LAST
     LIMIT 1
  ) last_scan ON true
  WHERE r.type IN ('skill'::public.v2_resource_type, 'automation'::public.v2_resource_type)
    AND EXISTS (SELECT 1 FROM public.resource_files f WHERE f.resource_version_id = rv.id)
    AND (last_scan.s IS NULL OR last_scan.s <> 'clean');

  SELECT count(*) INTO v_failed_payments
    FROM public.orders WHERE status = 'failed'::public.v2_order_status;
  -- Pending refunds attention count uses the actual value 'pending'
  SELECT count(*) INTO v_pending_refunds
    FROM public.refunds WHERE status = 'pending'::public.v2_refund_status;
  SELECT count(*) INTO v_open_reports
    FROM public.reports WHERE status = 'open'::public.v2_report_status;

  RETURN jsonb_build_object(
    'period_days', p_period_days,
    'period_since', v_since,
    'revenue_fils', coalesce(v_revenue_fils,0),
    'paid_orders', v_paid_orders,
    'failed_orders_period', v_failed_orders_period,
    'downloads', jsonb_build_object('available', false, 'reason', 'download event stream not wired'),
    'active_entitlements', v_active_entitlements,
    'lifetime_purchase_count', v_lifetime_purchases,
    'lifetime_threshold_count', v_lifetime_threshold,
    'payment_success_count', v_success_count,
    'payment_failure_count', v_failure_count,
    'payment_success_rate', v_success_rate,
    'refund_count', v_refund_count,
    'refund_denominator', v_refund_denominator,
    'refund_rate', v_refund_rate,
    'delivery_failures', jsonb_build_object('available', false, 'reason', 'email delivery events not wired'),
    'total_resources', v_total_resources,
    'published_resources', v_published_resources,
    'attention', jsonb_build_object(
      'drafts', v_drafts,
      'review', v_review,
      'scans', v_scans,
      'failed_payments', v_failed_payments,
      'pending_refunds', v_pending_refunds,
      'open_reports', v_open_reports
    )
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.save_admin_resource_draft(jsonb)                FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_publish_resource(uuid)                    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_transition_resource_lifecycle(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_v2_overview(int)                      FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.save_admin_resource_draft(jsonb)                TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_publish_resource(uuid)                    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_transition_resource_lifecycle(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_v2_overview(int)                      TO authenticated, service_role;
