
-- ============================================================================
-- get_admin_v2_overview: single authoritative source for Overview KPIs
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_admin_v2_overview(p_period_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_since timestamptz;
  v_revenue_fils bigint;
  v_paid_orders integer;
  v_failed_orders_period integer;
  v_active_entitlements integer;
  v_lifetime_purchase integer;
  v_lifetime_threshold integer;
  v_success_count integer;
  v_failure_count integer;
  v_refund_count integer;
  v_refund_denominator integer;
  v_attention_drafts integer;
  v_attention_review integer;
  v_attention_scans integer;
  v_attention_failed_payments integer;
  v_attention_pending_refunds integer;
  v_attention_open_reports integer;
  v_total_resources integer;
  v_published_resources integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  IF p_period_days IS NULL OR p_period_days <= 0 OR p_period_days > 3650 THEN
    p_period_days := 30;
  END IF;
  v_since := now() - make_interval(days => p_period_days);

  -- Revenue and paid orders in period
  SELECT COALESCE(SUM(paid_fils), 0)::bigint, COUNT(*)::int
    INTO v_revenue_fils, v_paid_orders
    FROM public.orders
   WHERE status = 'paid'
     AND placed_at >= v_since;

  SELECT COUNT(*)::int INTO v_failed_orders_period
    FROM public.orders
   WHERE status = 'failed'
     AND placed_at >= v_since;

  -- Payment success/failure counts in period (from payment_events)
  SELECT
    COALESCE(SUM(CASE WHEN event_type IN ('captured','authorized') THEN 1 ELSE 0 END), 0)::int,
    COALESCE(SUM(CASE WHEN event_type = 'failed' THEN 1 ELSE 0 END), 0)::int
    INTO v_success_count, v_failure_count
    FROM public.payment_events
   WHERE received_at >= v_since;

  -- Refunds in period
  SELECT COUNT(*)::int INTO v_refund_count
    FROM public.refunds
   WHERE created_at >= v_since
     AND status IN ('approved','processed');

  -- Denominator = paid orders in period
  v_refund_denominator := GREATEST(v_paid_orders, 0);

  -- Active entitlements (not revoked, not expired)
  SELECT COUNT(*)::int INTO v_active_entitlements
    FROM public.entitlements
   WHERE revoked_at IS NULL
     AND (expires_at IS NULL OR expires_at > now());

  SELECT COUNT(*)::int INTO v_lifetime_purchase
    FROM public.entitlements
   WHERE revoked_at IS NULL
     AND grant_reason = 'lifetime_purchase';

  SELECT COUNT(*)::int INTO v_lifetime_threshold
    FROM public.entitlements
   WHERE revoked_at IS NULL
     AND grant_reason = 'lifetime_threshold';

  -- Attention counts
  SELECT COUNT(*)::int INTO v_attention_drafts
    FROM public.resources WHERE lifecycle = 'draft';
  SELECT COUNT(*)::int INTO v_attention_review
    FROM public.resources WHERE lifecycle = 'review';

  -- Scans: latest scan per CURRENT version of a resource
  WITH latest_scans AS (
    SELECT DISTINCT ON (ps.resource_version_id)
           ps.resource_version_id,
           ps.status
      FROM public.package_scans ps
      ORDER BY ps.resource_version_id, ps.created_at DESC, ps.scanned_at DESC NULLS LAST
  )
  SELECT COUNT(*)::int INTO v_attention_scans
    FROM public.resources r
    JOIN latest_scans ls ON ls.resource_version_id = r.current_version_id
   WHERE r.lifecycle <> 'archived'
     AND ls.status::text IN ('pending','failed','suspicious','malicious');

  SELECT COUNT(*)::int INTO v_attention_failed_payments
    FROM public.orders WHERE status = 'failed';

  SELECT COUNT(*)::int INTO v_attention_pending_refunds
    FROM public.refunds WHERE status = 'pending';

  SELECT COUNT(*)::int INTO v_attention_open_reports
    FROM public.reports WHERE status = 'open';

  SELECT COUNT(*)::int INTO v_total_resources FROM public.resources;
  SELECT COUNT(*)::int INTO v_published_resources FROM public.resources WHERE lifecycle = 'published';

  RETURN jsonb_build_object(
    'period_days', p_period_days,
    'period_since', v_since,
    'generated_at', now(),
    'revenue_fils', v_revenue_fils,
    'paid_orders', v_paid_orders,
    'failed_orders_period', v_failed_orders_period,
    'downloads', jsonb_build_object(
      'available', false,
      'reason', 'download event log not implemented in v2 phase 1'
    ),
    'active_entitlements', v_active_entitlements,
    'lifetime_purchase_count', v_lifetime_purchase,
    'lifetime_threshold_count', v_lifetime_threshold,
    'payment_success_count', v_success_count,
    'payment_failure_count', v_failure_count,
    'payment_success_rate', CASE
      WHEN (v_success_count + v_failure_count) > 0
      THEN round((v_success_count::numeric / (v_success_count + v_failure_count)) * 100, 2)
      ELSE NULL
    END,
    'refund_count', v_refund_count,
    'refund_denominator', v_refund_denominator,
    'refund_rate', CASE
      WHEN v_refund_denominator > 0
      THEN round((v_refund_count::numeric / v_refund_denominator) * 100, 2)
      ELSE NULL
    END,
    'delivery_failures', jsonb_build_object(
      'available', false,
      'reason', 'no authoritative delivery-status feed wired'
    ),
    'total_resources', v_total_resources,
    'published_resources', v_published_resources,
    'attention', jsonb_build_object(
      'drafts', v_attention_drafts,
      'review', v_attention_review,
      'scans', v_attention_scans,
      'failed_payments', v_attention_failed_payments,
      'pending_refunds', v_attention_pending_refunds,
      'open_reports', v_attention_open_reports
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_v2_overview(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_v2_overview(integer) TO authenticated;

-- ============================================================================
-- admin_transition_resource_lifecycle: transactional lifecycle change + log
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_transition_resource_lifecycle(
  p_resource_id uuid,
  p_action text  -- 'review' | 'archive' | 'restore'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_lifecycle text;
  v_resource record;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT id, lifecycle INTO v_resource FROM public.resources WHERE id = p_resource_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'resource_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_action = 'review' THEN
    v_new_lifecycle := 'review';
    UPDATE public.resources SET lifecycle = 'review'::v2_resource_lifecycle, updated_at = now()
      WHERE id = p_resource_id;
  ELSIF p_action = 'archive' THEN
    v_new_lifecycle := 'archived';
    UPDATE public.resources
       SET lifecycle = 'archived'::v2_resource_lifecycle,
           archived_at = now(),
           updated_at = now()
     WHERE id = p_resource_id;
  ELSIF p_action = 'restore' THEN
    v_new_lifecycle := 'draft';
    UPDATE public.resources
       SET lifecycle = 'draft'::v2_resource_lifecycle,
           archived_at = NULL,
           updated_at = now()
     WHERE id = p_resource_id;
  ELSE
    RAISE EXCEPTION 'invalid_action' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.activity_events(actor_user_id, actor_type, entity_type, entity_id, action, metadata)
    VALUES (v_uid, 'admin', 'resource', p_resource_id, 'resource.' || p_action,
            jsonb_build_object('from', v_resource.lifecycle, 'to', v_new_lifecycle));

  RETURN jsonb_build_object('ok', true, 'resource_id', p_resource_id, 'lifecycle', v_new_lifecycle);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_transition_resource_lifecycle(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_transition_resource_lifecycle(uuid, text) TO authenticated;

-- ============================================================================
-- admin_publish_resource: server-side publication validation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_publish_resource(p_resource_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  r public.resources;
  v_version public.resource_versions;
  v_errors text[] := ARRAY[]::text[];
  v_type text;
  v_needs_files boolean;
  v_file_count int;
  v_scan_status text;
  v_platform_count int;
  v_guide_count int;
  v_has_active_product boolean;
  v_in_bundle boolean;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO r FROM public.resources WHERE id = p_resource_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'resource_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_type := r.type::text;

  -- Required metadata
  IF r.title_en IS NULL OR btrim(r.title_en) = '' THEN
    v_errors := array_append(v_errors, 'missing_title_en');
  END IF;
  IF r.summary_en IS NULL OR btrim(r.summary_en) = '' THEN
    v_errors := array_append(v_errors, 'missing_summary_en');
  END IF;
  IF r.description_en IS NULL OR btrim(r.description_en) = '' THEN
    v_errors := array_append(v_errors, 'missing_description_en');
  END IF;

  -- Current version required
  IF r.current_version_id IS NULL THEN
    v_errors := array_append(v_errors, 'missing_current_version');
  ELSE
    SELECT * INTO v_version FROM public.resource_versions WHERE id = r.current_version_id;
  END IF;

  -- File-bearing types require clean latest scan
  v_needs_files := v_type IN ('skill', 'automation');
  IF v_needs_files AND v_version.id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_file_count FROM public.resource_files
     WHERE resource_version_id = v_version.id;
    IF v_file_count = 0 THEN
      v_errors := array_append(v_errors, 'missing_package_files');
    ELSE
      SELECT status::text INTO v_scan_status
        FROM public.package_scans
       WHERE resource_version_id = v_version.id
       ORDER BY created_at DESC, scanned_at DESC NULLS LAST
       LIMIT 1;
      IF v_scan_status IS NULL THEN
        v_errors := array_append(v_errors, 'no_package_scan');
      ELSIF v_scan_status <> 'clean' THEN
        v_errors := array_append(v_errors, 'latest_scan_not_clean:' || v_scan_status);
      END IF;
    END IF;
  END IF;

  -- Platform compatibility for skills/automations
  IF v_type IN ('skill','automation') THEN
    SELECT COUNT(*) INTO v_platform_count FROM public.platform_compatibility
     WHERE resource_id = p_resource_id;
    IF v_platform_count = 0 THEN
      v_errors := array_append(v_errors, 'missing_platform_compatibility');
    END IF;

    SELECT COUNT(*) INTO v_guide_count FROM public.installation_guides
     WHERE resource_id = p_resource_id;
    IF v_guide_count = 0 THEN
      v_errors := array_append(v_errors, 'missing_installation_guide');
    END IF;
  END IF;

  -- Commerce: needs an active product OR must be included in a bundle (bundle-only)
  SELECT EXISTS(
    SELECT 1 FROM public.products
     WHERE resource_id = p_resource_id AND is_active = true
  ) INTO v_has_active_product;

  SELECT EXISTS(
    SELECT 1 FROM public.product_bundle_items WHERE resource_id = p_resource_id
  ) INTO v_in_bundle;

  IF NOT v_has_active_product AND NOT v_in_bundle THEN
    v_errors := array_append(v_errors, 'missing_active_product');
  END IF;

  IF array_length(v_errors, 1) IS NOT NULL AND array_length(v_errors, 1) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'errors', to_jsonb(v_errors));
  END IF;

  UPDATE public.resources
     SET lifecycle    = 'published'::v2_resource_lifecycle,
         published_at = COALESCE(published_at, now()),
         archived_at  = NULL,
         updated_at   = now()
   WHERE id = p_resource_id;

  IF v_version.id IS NOT NULL THEN
    UPDATE public.resource_versions
       SET published_at = COALESCE(published_at, now()),
           is_current   = true,
           updated_at   = now()
     WHERE id = v_version.id;
  END IF;

  INSERT INTO public.activity_events(actor_user_id, actor_type, entity_type, entity_id, action, metadata)
    VALUES (v_uid, 'admin', 'resource', p_resource_id, 'resource.publish',
            jsonb_build_object('version_id', v_version.id));

  RETURN jsonb_build_object('ok', true, 'resource_id', p_resource_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_publish_resource(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_publish_resource(uuid) TO authenticated;

-- ============================================================================
-- save_admin_resource_draft: transactional publisher upsert
-- Payload allowlist (jsonb):
-- {
--   resource_id?: uuid,
--   resource: { slug, type, title_en, title_ar?, summary_en?, summary_ar?,
--               description_en?, description_ar?, category?, tags?[],
--               hero_image_path?, effort_minutes? },
--   version?: { version, changelog_en?, changelog_ar?, is_new_version? },
--   platform_compatibility?: [{ platform_slug, min_version?, notes_en?, notes_ar?, is_verified? }],
--   installation_guides?: [{ platform_slug, steps_en, steps_ar?, estimated_minutes? }],
--   permissions?: [{ kind, key, label_en?, label_ar?, is_required?, is_public? }],
--   license?: { license_key, terms_en?, terms_ar?, allows_commercial?, allows_redistribution? },
--   products?: [{ sku, product_type, title_en, title_ar?, price_fils, currency? }],
--   bundle_items?: [uuid, ...]   -- only when resource.type = 'bundle'
-- }
-- ============================================================================
CREATE OR REPLACE FUNCTION public.save_admin_resource_draft(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_resource_id uuid;
  v_existing public.resources;
  v_slug text;
  v_type text;
  v_row public.resources;
  v_version_id uuid;
  v_new_version boolean;
  v_bundle_product_id uuid;
  v_item jsonb;
  v_sku text;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;
  IF payload IS NULL OR payload -> 'resource' IS NULL THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
  END IF;

  v_slug := btrim(payload #>> '{resource,slug}');
  v_type := payload #>> '{resource,type}';
  v_resource_id := NULLIF(payload ->> 'resource_id','')::uuid;

  IF v_slug IS NULL OR v_slug = '' OR v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'invalid_slug' USING ERRCODE = '22023';
  END IF;
  IF v_type IS NULL OR v_type NOT IN ('skill','automation','prompt','prompt_pack','image_style','bundle') THEN
    RAISE EXCEPTION 'invalid_type' USING ERRCODE = '22023';
  END IF;

  IF v_resource_id IS NULL THEN
    -- New resource: slug must be unique
    IF EXISTS(SELECT 1 FROM public.resources WHERE slug = v_slug) THEN
      RAISE EXCEPTION 'slug_taken' USING ERRCODE = '23505';
    END IF;
    INSERT INTO public.resources(
      slug, type, lifecycle,
      title_en, title_ar, summary_en, summary_ar, description_en, description_ar,
      category, tags, hero_image_path, effort_minutes, owner_id
    )
    VALUES (
      v_slug,
      v_type::v2_resource_type,
      'draft'::v2_resource_lifecycle,
      NULLIF(btrim(payload #>> '{resource,title_en}'),''),
      NULLIF(btrim(payload #>> '{resource,title_ar}'),''),
      NULLIF(btrim(payload #>> '{resource,summary_en}'),''),
      NULLIF(btrim(payload #>> '{resource,summary_ar}'),''),
      NULLIF(btrim(payload #>> '{resource,description_en}'),''),
      NULLIF(btrim(payload #>> '{resource,description_ar}'),''),
      NULLIF(btrim(payload #>> '{resource,category}'),''),
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(payload #> '{resource,tags}')), ARRAY[]::text[]),
      NULLIF(btrim(payload #>> '{resource,hero_image_path}'),''),
      NULLIF(payload #>> '{resource,effort_minutes}','')::int,
      NULL   -- V2: never take arbitrary creator ownership from clients
    )
    RETURNING * INTO v_row;
    v_resource_id := v_row.id;
  ELSE
    SELECT * INTO v_existing FROM public.resources WHERE id = v_resource_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'resource_not_found' USING ERRCODE = 'P0002';
    END IF;
    -- Slug edits must remain unique
    IF v_slug <> v_existing.slug AND EXISTS(
      SELECT 1 FROM public.resources WHERE slug = v_slug AND id <> v_resource_id
    ) THEN
      RAISE EXCEPTION 'slug_taken' USING ERRCODE = '23505';
    END IF;
    UPDATE public.resources SET
      slug             = v_slug,
      type             = v_type::v2_resource_type,
      title_en         = NULLIF(btrim(payload #>> '{resource,title_en}'),''),
      title_ar         = NULLIF(btrim(payload #>> '{resource,title_ar}'),''),
      summary_en       = NULLIF(btrim(payload #>> '{resource,summary_en}'),''),
      summary_ar       = NULLIF(btrim(payload #>> '{resource,summary_ar}'),''),
      description_en   = NULLIF(btrim(payload #>> '{resource,description_en}'),''),
      description_ar   = NULLIF(btrim(payload #>> '{resource,description_ar}'),''),
      category         = NULLIF(btrim(payload #>> '{resource,category}'),''),
      tags             = COALESCE(ARRAY(SELECT jsonb_array_elements_text(payload #> '{resource,tags}')), ARRAY[]::text[]),
      hero_image_path  = NULLIF(btrim(payload #>> '{resource,hero_image_path}'),''),
      effort_minutes   = NULLIF(payload #>> '{resource,effort_minutes}','')::int,
      updated_at       = now()
      WHERE id = v_resource_id
      RETURNING * INTO v_row;
  END IF;

  -- Version handling: optional. If version.is_new_version = true, always insert.
  IF payload -> 'version' IS NOT NULL AND (payload #>> '{version,version}') IS NOT NULL THEN
    v_new_version := COALESCE((payload #>> '{version,is_new_version}')::boolean, false);
    IF v_new_version OR v_row.current_version_id IS NULL THEN
      INSERT INTO public.resource_versions(
        resource_id, version, changelog_en, changelog_ar, is_current
      )
      VALUES(
        v_resource_id,
        btrim(payload #>> '{version,version}'),
        NULLIF(btrim(payload #>> '{version,changelog_en}'),''),
        NULLIF(btrim(payload #>> '{version,changelog_ar}'),''),
        true
      )
      RETURNING id INTO v_version_id;
      -- Demote other versions
      UPDATE public.resource_versions SET is_current = false, updated_at = now()
        WHERE resource_id = v_resource_id AND id <> v_version_id;
      UPDATE public.resources
         SET current_version_id = v_version_id, updated_at = now()
       WHERE id = v_resource_id;
    ELSE
      UPDATE public.resource_versions SET
        version      = btrim(payload #>> '{version,version}'),
        changelog_en = NULLIF(btrim(payload #>> '{version,changelog_en}'),''),
        changelog_ar = NULLIF(btrim(payload #>> '{version,changelog_ar}'),''),
        updated_at   = now()
        WHERE id = v_row.current_version_id
        RETURNING id INTO v_version_id;
    END IF;
  END IF;

  -- Replace platform compatibility set
  IF payload ? 'platform_compatibility' THEN
    DELETE FROM public.platform_compatibility WHERE resource_id = v_resource_id;
    INSERT INTO public.platform_compatibility(resource_id, platform_slug, min_version, notes_en, notes_ar, is_verified)
    SELECT v_resource_id,
           btrim(x ->> 'platform_slug'),
           NULLIF(btrim(x ->> 'min_version'),''),
           NULLIF(btrim(x ->> 'notes_en'),''),
           NULLIF(btrim(x ->> 'notes_ar'),''),
           COALESCE((x ->> 'is_verified')::boolean, false)
      FROM jsonb_array_elements(payload -> 'platform_compatibility') AS x
     WHERE btrim(x ->> 'platform_slug') <> '';
  END IF;

  -- Installation guides
  IF payload ? 'installation_guides' THEN
    DELETE FROM public.installation_guides WHERE resource_id = v_resource_id;
    INSERT INTO public.installation_guides(resource_id, platform_slug, steps_en, steps_ar, estimated_minutes)
    SELECT v_resource_id,
           btrim(x ->> 'platform_slug'),
           COALESCE(x -> 'steps_en', '[]'::jsonb),
           COALESCE(x -> 'steps_ar', '[]'::jsonb),
           NULLIF(x ->> 'estimated_minutes','')::int
      FROM jsonb_array_elements(payload -> 'installation_guides') AS x
     WHERE btrim(x ->> 'platform_slug') <> '';
  END IF;

  -- Permissions
  IF payload ? 'permissions' THEN
    DELETE FROM public.resource_permissions WHERE resource_id = v_resource_id;
    INSERT INTO public.resource_permissions(resource_id, kind, key, label_en, label_ar, is_required, is_public)
    SELECT v_resource_id,
           btrim(x ->> 'kind'),
           btrim(x ->> 'key'),
           NULLIF(btrim(x ->> 'label_en'),''),
           NULLIF(btrim(x ->> 'label_ar'),''),
           COALESCE((x ->> 'is_required')::boolean, false),
           COALESCE((x ->> 'is_public')::boolean, true)
      FROM jsonb_array_elements(payload -> 'permissions') AS x
     WHERE btrim(x ->> 'kind') <> '' AND btrim(x ->> 'key') <> '';
  END IF;

  -- License (single row per resource)
  IF payload ? 'license' AND payload -> 'license' IS NOT NULL THEN
    INSERT INTO public.licenses(resource_id, license_key, terms_en, terms_ar, allows_commercial, allows_redistribution)
    VALUES(
      v_resource_id,
      btrim(payload #>> '{license,license_key}'),
      NULLIF(btrim(payload #>> '{license,terms_en}'),''),
      NULLIF(btrim(payload #>> '{license,terms_ar}'),''),
      COALESCE((payload #>> '{license,allows_commercial}')::boolean, false),
      COALESCE((payload #>> '{license,allows_redistribution}')::boolean, false)
    )
    ON CONFLICT (resource_id) DO UPDATE SET
      license_key           = EXCLUDED.license_key,
      terms_en              = EXCLUDED.terms_en,
      terms_ar              = EXCLUDED.terms_ar,
      allows_commercial     = EXCLUDED.allows_commercial,
      allows_redistribution = EXCLUDED.allows_redistribution,
      updated_at            = now();
  END IF;

  -- Products (individual/free): deactivate then upsert by sku
  IF payload ? 'products' THEN
    UPDATE public.products SET is_active = false, updated_at = now()
     WHERE resource_id = v_resource_id;
    FOR v_item IN SELECT * FROM jsonb_array_elements(payload -> 'products')
    LOOP
      v_sku := btrim(v_item ->> 'sku');
      IF v_sku = '' THEN CONTINUE; END IF;
      INSERT INTO public.products(sku, product_type, resource_id, title_en, title_ar, price_fils, currency, is_active)
      VALUES(
        v_sku,
        (v_item ->> 'product_type')::v2_product_type,
        v_resource_id,
        btrim(v_item ->> 'title_en'),
        NULLIF(btrim(v_item ->> 'title_ar'),''),
        COALESCE((v_item ->> 'price_fils')::int, 0),
        COALESCE(NULLIF(btrim(v_item ->> 'currency'),''), 'KWD'),
        true
      )
      ON CONFLICT (sku) DO UPDATE SET
        product_type = EXCLUDED.product_type,
        resource_id  = EXCLUDED.resource_id,
        title_en     = EXCLUDED.title_en,
        title_ar     = EXCLUDED.title_ar,
        price_fils   = EXCLUDED.price_fils,
        currency     = EXCLUDED.currency,
        is_active    = true,
        updated_at   = now();
    END LOOP;
  END IF;

  -- Bundle items: only meaningful when the resource itself is a bundle,
  -- but the linking table stores by bundle_product_id. Resolve by picking
  -- the active bundle product for this resource (create if missing).
  IF v_type = 'bundle' AND (payload ? 'bundle_items') THEN
    SELECT id INTO v_bundle_product_id FROM public.products
      WHERE resource_id = v_resource_id AND product_type = 'bundle' AND is_active = true
      ORDER BY created_at DESC LIMIT 1;
    IF v_bundle_product_id IS NULL THEN
      INSERT INTO public.products(sku, product_type, resource_id, title_en, price_fils, is_active)
      VALUES('bundle-' || v_slug, 'bundle', v_resource_id, COALESCE(v_row.title_en, v_slug), 0, true)
      RETURNING id INTO v_bundle_product_id;
    END IF;
    DELETE FROM public.product_bundle_items WHERE bundle_product_id = v_bundle_product_id;
    INSERT INTO public.product_bundle_items(bundle_product_id, resource_id)
    SELECT v_bundle_product_id, (elem)::uuid
      FROM jsonb_array_elements_text(payload -> 'bundle_items') AS elem
     WHERE elem IS NOT NULL AND elem <> '';
  END IF;

  INSERT INTO public.activity_events(actor_user_id, actor_type, entity_type, entity_id, action, metadata)
    VALUES (v_uid, 'admin', 'resource', v_resource_id, 'resource.draft_saved',
            jsonb_build_object('slug', v_slug, 'type', v_type));

  RETURN jsonb_build_object('ok', true, 'resource_id', v_resource_id, 'slug', v_slug);
END;
$$;

REVOKE ALL ON FUNCTION public.save_admin_resource_draft(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_admin_resource_draft(jsonb) TO authenticated;

-- Unique constraint required by license upsert (safe if it already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'licenses_resource_id_key'
  ) THEN
    ALTER TABLE public.licenses ADD CONSTRAINT licenses_resource_id_key UNIQUE(resource_id);
  END IF;
END $$;
