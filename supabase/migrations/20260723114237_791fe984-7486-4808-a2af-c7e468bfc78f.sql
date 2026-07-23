CREATE OR REPLACE FUNCTION public.v2_admin_upsert_discount(p_id uuid, p_code text, p_kind text, p_value integer, p_starts_at timestamp with time zone, p_expires_at timestamp with time zone, p_min_order_fils integer, p_max_total_uses integer, p_max_uses_per_user integer, p_applies_to_all boolean, p_applies_to_lifetime boolean, p_applicable_product_ids uuid[], p_is_active boolean, p_notes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_norm text;
  v_id uuid;
  v_existing public.v2_discount_codes%ROWTYPE;
  v_conflict uuid;
  v_missing uuid[];
  v_used int;
  v_action text;
  v_final public.v2_discount_codes%ROWTYPE;
BEGIN
  PERFORM public._v2_require_admin();

  IF p_code IS NULL OR btrim(p_code) = '' THEN
    RAISE EXCEPTION 'code_required' USING ERRCODE='22023';
  END IF;
  IF p_kind NOT IN ('percent','fixed_fils') THEN
    RAISE EXCEPTION 'invalid_kind' USING ERRCODE='22023';
  END IF;
  IF p_value IS NULL OR p_value <= 0 THEN
    RAISE EXCEPTION 'invalid_value' USING ERRCODE='22023';
  END IF;
  IF p_kind = 'percent' AND (p_value < 1 OR p_value > 100) THEN
    RAISE EXCEPTION 'percent_out_of_range' USING ERRCODE='22023';
  END IF;
  IF COALESCE(p_min_order_fils,0) < 0 THEN
    RAISE EXCEPTION 'invalid_min_order' USING ERRCODE='22023';
  END IF;
  IF p_max_total_uses IS NOT NULL AND p_max_total_uses <= 0 THEN
    RAISE EXCEPTION 'invalid_max_total_uses' USING ERRCODE='22023';
  END IF;
  IF p_max_uses_per_user IS NOT NULL AND p_max_uses_per_user <= 0 THEN
    RAISE EXCEPTION 'invalid_max_uses_per_user' USING ERRCODE='22023';
  END IF;
  IF p_starts_at IS NOT NULL AND p_expires_at IS NOT NULL AND p_expires_at <= p_starts_at THEN
    RAISE EXCEPTION 'window_invalid' USING ERRCODE='22023';
  END IF;
  IF (NOT COALESCE(p_applies_to_all,true))
     AND (p_applicable_product_ids IS NULL OR array_length(p_applicable_product_ids,1) IS NULL) THEN
    RAISE EXCEPTION 'scope_products_required' USING ERRCODE='22023';
  END IF;

  v_norm := lower(btrim(p_code));

  IF (NOT p_applies_to_all) THEN
    SELECT COALESCE(array_agg(pid),'{}') INTO v_missing
      FROM unnest(p_applicable_product_ids) pid
     WHERE NOT EXISTS (SELECT 1 FROM public.products x WHERE x.id = pid);
    IF array_length(v_missing,1) IS NOT NULL THEN
      RAISE EXCEPTION 'unknown_products' USING ERRCODE='P0002';
    END IF;
  END IF;

  IF p_id IS NULL THEN
    v_action := 'create';

    SELECT id INTO v_conflict FROM public.v2_discount_codes
      WHERE code_normalized = v_norm LIMIT 1;
    IF v_conflict IS NOT NULL THEN
      RAISE EXCEPTION 'code_conflict' USING ERRCODE='23505';
    END IF;

    BEGIN
      INSERT INTO public.v2_discount_codes (
        code, kind, value, starts_at, expires_at, min_order_fils,
        max_total_uses, max_uses_per_user, applies_to_all,
        applies_to_lifetime, applicable_product_ids, is_active, notes,
        created_by, updated_by
      ) VALUES (
        p_code, p_kind, p_value, p_starts_at, p_expires_at, p_min_order_fils,
        p_max_total_uses, p_max_uses_per_user, COALESCE(p_applies_to_all,true),
        COALESCE(p_applies_to_lifetime,false),
        CASE WHEN p_applies_to_all THEN '{}'::uuid[] ELSE p_applicable_product_ids END,
        COALESCE(p_is_active,true), NULLIF(btrim(COALESCE(p_notes,'')),''),
        v_actor, v_actor
      ) RETURNING id INTO v_id;
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'code_conflict' USING ERRCODE='23505';
    END;
  ELSE
    v_action := 'update';
    SELECT * INTO v_existing FROM public.v2_discount_codes WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
    IF v_existing.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'archived_immutable' USING ERRCODE='22023';
    END IF;

    SELECT count(*)::int INTO v_used
      FROM public.v2_discount_redemptions
     WHERE discount_code_id = v_existing.id AND status IN ('reserved','consumed');

    IF v_used > 0 THEN
      IF v_existing.code_normalized <> v_norm
         OR v_existing.kind <> p_kind
         OR v_existing.value <> p_value
         OR v_existing.applies_to_lifetime <> COALESCE(p_applies_to_lifetime,false) THEN
        RAISE EXCEPTION 'used_code_immutable_fields' USING ERRCODE='22023';
      END IF;
    ELSE
      SELECT id INTO v_conflict FROM public.v2_discount_codes
        WHERE code_normalized = v_norm AND id <> p_id LIMIT 1;
      IF v_conflict IS NOT NULL THEN
        RAISE EXCEPTION 'code_conflict' USING ERRCODE='23505';
      END IF;
    END IF;

    BEGIN
      UPDATE public.v2_discount_codes SET
        code = p_code,
        kind = p_kind,
        value = p_value,
        starts_at = p_starts_at,
        expires_at = p_expires_at,
        min_order_fils = p_min_order_fils,
        max_total_uses = p_max_total_uses,
        max_uses_per_user = p_max_uses_per_user,
        applies_to_all = COALESCE(p_applies_to_all,true),
        applies_to_lifetime = COALESCE(p_applies_to_lifetime,false),
        applicable_product_ids =
          CASE WHEN p_applies_to_all THEN '{}'::uuid[] ELSE p_applicable_product_ids END,
        is_active = COALESCE(p_is_active,true),
        notes = NULLIF(btrim(COALESCE(p_notes,'')),''),
        updated_by = v_actor,
        updated_at = now()
      WHERE id = p_id;
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'code_conflict' USING ERRCODE='23505';
    END;
    v_id := p_id;
  END IF;

  SELECT * INTO v_final FROM public.v2_discount_codes WHERE id = v_id;

  INSERT INTO public.activity_events (actor_user_id, actor_type, entity_type, entity_id, action, metadata)
  VALUES (
    v_actor, 'admin', 'v2_discount_code', v_id,
    'v2_discount_' || v_action,
    jsonb_build_object(
      'code_normalized', v_final.code_normalized,
      'kind', v_final.kind,
      'value', v_final.value,
      'applies_to_all', v_final.applies_to_all,
      'applies_to_lifetime', v_final.applies_to_lifetime,
      'is_active', v_final.is_active,
      'starts_at', v_final.starts_at,
      'expires_at', v_final.expires_at,
      'min_order_fils', v_final.min_order_fils,
      'max_total_uses', v_final.max_total_uses,
      'max_uses_per_user', v_final.max_uses_per_user,
      'applicable_product_ids', v_final.applicable_product_ids
    )
  );

  RETURN public.v2_admin_get_discount(v_id);
END;
$function$;