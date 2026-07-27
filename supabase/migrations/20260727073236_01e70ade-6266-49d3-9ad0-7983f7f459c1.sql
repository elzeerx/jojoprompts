-- Corrective lifecycle hardening: server-side state matrix + bundle integrity.
-- Non-destructive: replaces function bodies only. Signatures unchanged.

CREATE OR REPLACE FUNCTION public.admin_transition_resource_lifecycle(p_resource_id uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_admin boolean;
  v_new_lifecycle text;
  v_prev_lifecycle text;
  v_current_version_id uuid;
  v_updated int;
  v_errs text[];
  v_allowed boolean;
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

  SELECT lifecycle::text, current_version_id
    INTO v_prev_lifecycle, v_current_version_id
  FROM public.resources
  WHERE id = p_resource_id
  FOR UPDATE;

  IF v_prev_lifecycle IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- Idempotency: same-state transitions succeed without side-effects or audit noise.
  IF v_prev_lifecycle = v_new_lifecycle THEN
    RETURN jsonb_build_object(
      'ok', true,
      'no_change', true,
      'previous_lifecycle', v_prev_lifecycle,
      'resulting_lifecycle', v_new_lifecycle
    );
  END IF;

  -- Authoritative state matrix (mirrors src/lib/v2/admin/lifecycleTransitions.ts):
  --   draft     -> review | published | archived
  --   review    -> published | archived
  --   published -> archived
  --   archived  -> draft (via restore) only
  v_allowed := CASE
    WHEN p_action = 'review'  AND v_prev_lifecycle = 'draft' THEN true
    WHEN p_action = 'archive' AND v_prev_lifecycle IN ('draft','review','published') THEN true
    WHEN p_action = 'restore' AND v_prev_lifecycle = 'archived' THEN true
    ELSE false
  END;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'invalid_transition',
      'previous_lifecycle', v_prev_lifecycle,
      'attempted_action', p_action,
      'resulting_lifecycle', v_new_lifecycle
    );
  END IF;

  -- Validate readiness for 'review' transitions using the shared validator.
  IF p_action = 'review' THEN
    v_errs := private._v2_resource_publish_errors(p_resource_id);
    IF v_errs = ARRAY['resource_not_found']::text[] THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_found', 'errors', v_errs);
    END IF;
    IF array_length(v_errs, 1) IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'validation_failed', 'errors', v_errs);
    END IF;
  END IF;

  UPDATE public.resources
     SET lifecycle = v_new_lifecycle::public.v2_resource_lifecycle,
         archived_at = CASE WHEN v_new_lifecycle='archived' THEN now() ELSE NULL END,
         updated_at = now()
   WHERE id = p_resource_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  INSERT INTO public.activity_events (
    actor_user_id, actor_type, entity_type, entity_id, action, metadata
  ) VALUES (
    v_actor, 'admin', 'resource', p_resource_id, 'lifecycle_' || p_action,
    jsonb_build_object(
      'previous_lifecycle', v_prev_lifecycle,
      'resulting_lifecycle', v_new_lifecycle,
      'version_id', v_current_version_id
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'previous_lifecycle', v_prev_lifecycle,
    'resulting_lifecycle', v_new_lifecycle
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_publish_resource(p_resource_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_admin boolean;
  v_r RECORD;
  v_prev_lifecycle text;
  v_errs text[] := ARRAY[]::text[];
  v_active_products int;
  v_positive_bundle_products int;
  v_has_bad_lifetime boolean;
  v_scan_status text;
  v_self_included int;
  v_dup_count int;
BEGIN
  SELECT public.has_role(v_actor, 'admin'::public.app_role) INTO v_admin;
  IF NOT v_admin THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_r FROM public.resources WHERE id = p_resource_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'errors', ARRAY['resource_not_found']);
  END IF;

  v_prev_lifecycle := v_r.lifecycle::text;

  -- Idempotency: republishing an already-published resource is a no-op with no audit.
  IF v_prev_lifecycle = 'published' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'no_change', true,
      'resource_id', p_resource_id,
      'previous_lifecycle', v_prev_lifecycle,
      'resulting_lifecycle', 'published'
    );
  END IF;

  -- Authoritative state matrix: publish only from draft or review.
  IF v_prev_lifecycle NOT IN ('draft','review') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'invalid_transition',
      'previous_lifecycle', v_prev_lifecycle,
      'attempted_action', 'publish',
      'resulting_lifecycle', 'published'
    );
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

    -- Self-inclusion: bundle resource cannot include itself as an item.
    SELECT count(*) INTO v_self_included
      FROM public.product_bundle_items pbi
      JOIN public.products p ON p.id = pbi.bundle_product_id
     WHERE p.resource_id = p_resource_id
       AND pbi.resource_id = p_resource_id;
    IF v_self_included > 0 THEN
      v_errs := v_errs || 'bundle_self_inclusion';
    END IF;

    -- Duplicate item across all bundle products for this resource.
    -- Note: UNIQUE(bundle_product_id, resource_id) prevents dupes per product,
    -- but a resource may have multiple bundle products; enforce uniqueness across
    -- the union to match publishValidation.ts.
    SELECT count(*) INTO v_dup_count FROM (
      SELECT pbi.resource_id
        FROM public.product_bundle_items pbi
        JOIN public.products p ON p.id = pbi.bundle_product_id
       WHERE p.resource_id = p_resource_id
       GROUP BY pbi.resource_id
      HAVING count(*) > 1
    ) d;
    IF v_dup_count > 0 THEN
      v_errs := v_errs || 'bundle_duplicate_item';
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

  INSERT INTO public.activity_events (
    actor_user_id, actor_type, entity_type, entity_id, action, metadata
  ) VALUES (
    v_actor, 'admin', 'resource', p_resource_id, 'publish',
    jsonb_build_object(
      'previous_lifecycle', v_prev_lifecycle,
      'resulting_lifecycle', 'published',
      'version_id', v_r.current_version_id
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'resource_id', p_resource_id,
    'previous_lifecycle', v_prev_lifecycle,
    'resulting_lifecycle', 'published'
  );
END;
$function$;