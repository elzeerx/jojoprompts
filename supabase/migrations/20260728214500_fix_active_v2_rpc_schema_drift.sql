-- Repair active V2/admin RPCs that still referenced pre-V2 column names.
--
-- The public V2 schema uses:
--   products.title_en
--   resources.title_en
--   resources.type
--   resources.latest_published_version_id
--
-- Keep the existing JSON response keys stable for the frontend while making
-- every query match the promoted schema.

-- ---------------------------------------------------------------------------
-- 1) Order detail
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.v2_admin_get_order_detail(
  p_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
  v_order jsonb;
  v_items jsonb;
  v_attempts jsonb;
  v_events jsonb;
  v_refunds jsonb;
  v_entitlements jsonb;
  v_credit jsonb;
  v_activity jsonb;
BEGIN
  v_actor := public._v2_require_admin();

  SELECT jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'status', o.status,
    'currency', o.currency,
    'subtotal_fils', o.subtotal_fils,
    'discount_fils', o.discount_fils,
    'discount_code', o.discount_code,
    'total_fils', o.total_fils,
    'paid_fils', o.paid_fils,
    'lifetime_credit_applied_fils', o.lifetime_credit_applied_fils,
    'provider', o.provider,
    'provider_reference', o.provider_reference,
    'idempotency_key', o.idempotency_key,
    'placed_at', o.placed_at,
    'settled_at', o.settled_at,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'user_id', o.user_id,
    'user_email', p.email,
    'user_name', trim(
      coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')
    )
  )
    INTO v_order
    FROM public.orders o
    LEFT JOIN public.profiles p ON p.id = o.user_id
   WHERE o.id = p_order_id;

  IF v_order IS NULL THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', oi.id,
    'product_id', oi.product_id,
    'resource_id', oi.resource_id,
    'quantity', oi.quantity,
    'unit_price_fils', oi.unit_price_fils,
    'line_total_fils', oi.line_total_fils,
    'paid_allocation_fils', oi.paid_allocation_fils,
    'resource_version_id', oi.resource_version_id,
    'acquired_major_version', oi.acquired_major_version,
    'product_sku', pr.sku,
    'product_type', pr.product_type,
    'resource_title', rs.title_en,
    'resource_type', rs.type
  ) ORDER BY oi.created_at), '[]'::jsonb)
    INTO v_items
    FROM public.order_items oi
    LEFT JOIN public.products pr ON pr.id = oi.product_id
    LEFT JOIN public.resources rs ON rs.id = oi.resource_id
   WHERE oi.order_id = p_order_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', pa.id,
    'provider', pa.provider,
    'status', pa.status,
    'merchant_reference', pa.merchant_reference,
    'track_id', pa.track_id,
    'session_id', pa.session_id,
    'provider_order_id', pa.provider_order_id,
    'expected_amount_fils', pa.expected_amount_fils,
    'currency', pa.currency,
    'provider_submission_state', pa.provider_submission_state,
    'last_provider_http_status', pa.last_provider_http_status,
    'last_checked_at', pa.last_checked_at,
    'next_check_after', pa.next_check_after,
    'check_count', pa.check_count,
    'created_at', pa.created_at,
    'updated_at', pa.updated_at
  ) ORDER BY pa.created_at DESC), '[]'::jsonb)
    INTO v_attempts
    FROM public.payment_attempts pa
   WHERE pa.order_id = p_order_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', pe.id,
    'provider', pe.provider,
    'event_type', pe.event_type,
    'external_event_id', pe.external_event_id,
    'amount_fils', pe.amount_fils,
    'currency', pe.currency,
    'received_at', pe.received_at
  ) ORDER BY pe.received_at DESC), '[]'::jsonb)
    INTO v_events
    FROM public.payment_events pe
   WHERE pe.order_id = p_order_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'status', r.status,
    'amount_fils', r.amount_fils,
    'reason', r.reason,
    'provider_reference', r.provider_reference,
    'provider_refund_order_id', r.provider_refund_order_id,
    'provider_submission_state', r.provider_submission_state,
    'requested_at', r.requested_at,
    'processed_at', r.processed_at,
    'items', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'order_item_id', ri.order_item_id,
        'amount_fils', ri.amount_fils
      )), '[]'::jsonb)
        FROM public.refund_items ri
       WHERE ri.refund_id = r.id
    )
  ) ORDER BY r.requested_at DESC), '[]'::jsonb)
    INTO v_refunds
    FROM public.refunds r
   WHERE r.order_id = p_order_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'scope', e.scope,
    'resource_id', e.resource_id,
    'grant_reason', e.grant_reason,
    'source_order_item_id', e.source_order_item_id,
    'granted_at', e.granted_at,
    'revoked_at', e.revoked_at,
    'revoke_reason', e.revoke_reason,
    'expires_at', e.expires_at,
    'version_major', e.version_major
  ) ORDER BY e.granted_at DESC), '[]'::jsonb)
    INTO v_entitlements
    FROM public.entitlements e
   WHERE e.order_id = p_order_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', lc.id,
    'amount_fils', lc.amount_fils,
    'reason', lc.reason,
    'refund_id', lc.refund_id,
    'occurred_at', lc.occurred_at
  ) ORDER BY lc.occurred_at DESC), '[]'::jsonb)
    INTO v_credit
    FROM public.lifetime_credit_entries lc
   WHERE lc.order_id = p_order_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'action', a.action,
    'actor_type', a.actor_type,
    'entity_type', a.entity_type,
    'entity_id', a.entity_id,
    'metadata', a.metadata,
    'created_at', a.created_at
  ) ORDER BY a.created_at DESC), '[]'::jsonb)
    INTO v_activity
    FROM public.activity_events a
   WHERE a.entity_id = p_order_id
      OR (a.entity_type = 'order' AND a.entity_id = p_order_id);

  RETURN jsonb_build_object(
    'order', v_order,
    'items', v_items,
    'attempts', v_attempts,
    'events', v_events,
    'refunds', v_refunds,
    'entitlements', v_entitlements,
    'lifetime_credit', v_credit,
    'activity', v_activity
  );
END
$$;

REVOKE ALL ON FUNCTION public.v2_admin_get_order_detail(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.v2_admin_get_order_detail(uuid)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) Entitlement list
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.v2_admin_list_entitlements(
  p_scope text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
  v_limit int;
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_total bigint;
  v_rows jsonb;
  v_search text := nullif(trim(coalesce(p_search, '')), '');
BEGIN
  v_actor := public._v2_require_admin();
  v_limit := public._v2_bounded_limit(p_limit, 200);

  WITH filt AS (
    SELECT
      e.*,
      p.email AS user_email,
      r.title_en AS resource_title,
      r.type AS resource_type_col
      FROM public.entitlements e
      LEFT JOIN public.profiles p ON p.id = e.user_id
      LEFT JOIN public.resources r ON r.id = e.resource_id
     WHERE (p_scope IS NULL OR e.scope::text = p_scope)
       AND (p_reason IS NULL OR e.grant_reason::text = p_reason)
       AND (
         p_state IS NULL
         OR (
           p_state = 'active'
           AND e.revoked_at IS NULL
           AND (e.expires_at IS NULL OR e.expires_at > now())
         )
         OR (p_state = 'revoked' AND e.revoked_at IS NOT NULL)
         OR (
           p_state = 'expired'
           AND e.expires_at IS NOT NULL
           AND e.expires_at <= now()
           AND e.revoked_at IS NULL
         )
       )
       AND (
         v_search IS NULL
         OR p.email ILIKE '%' || v_search || '%'
         OR r.title_en ILIKE '%' || v_search || '%'
         OR e.collection_key ILIKE '%' || v_search || '%'
       )
  ),
  page AS (
    SELECT *
      FROM filt
     ORDER BY granted_at DESC
     LIMIT v_limit
    OFFSET v_offset
  )
  SELECT
    (SELECT count(*) FROM filt),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', page.id,
      'user_id', page.user_id,
      'user_email_masked', public._v2_mask_email(page.user_email),
      'scope', page.scope,
      'collection_key', page.collection_key,
      'resource_id', page.resource_id,
      'resource_title', page.resource_title,
      'resource_type', page.resource_type_col,
      'grant_reason', page.grant_reason,
      'order_id', page.order_id,
      'source_order_item_id', page.source_order_item_id,
      'granted_at', page.granted_at,
      'revoked_at', page.revoked_at,
      'revoke_reason', page.revoke_reason,
      'expires_at', page.expires_at,
      'version_major', page.version_major,
      'state', CASE
        WHEN page.revoked_at IS NOT NULL THEN 'revoked'
        WHEN page.expires_at IS NOT NULL
             AND page.expires_at <= now() THEN 'expired'
        ELSE 'active'
      END
    ) ORDER BY page.granted_at DESC), '[]'::jsonb)
    INTO v_total, v_rows
    FROM page;

  RETURN jsonb_build_object(
    'total_count', v_total,
    'rows', v_rows,
    'limit', v_limit,
    'offset', v_offset
  );
END
$$;

REVOKE ALL
  ON FUNCTION public.v2_admin_list_entitlements(
    text, text, text, text, int, int
  )
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE
  ON FUNCTION public.v2_admin_list_entitlements(
    text, text, text, text, int, int
  )
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Discount detail and product picker
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.v2_admin_get_discount(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := public._v2_require_admin();
  v_d record;
  v_used int;
  v_consumed int;
  v_products jsonb;
BEGIN
  SELECT *
    INTO v_d
    FROM public.v2_discount_codes
   WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*)::int
    INTO v_used
    FROM public.v2_discount_redemptions
   WHERE discount_code_id = v_d.id
     AND status IN ('reserved', 'consumed');

  SELECT count(*)::int
    INTO v_consumed
    FROM public.v2_discount_redemptions
   WHERE discount_code_id = v_d.id
     AND status = 'consumed';

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'title', p.title_en,
    'product_type', p.product_type,
    'price_fils', p.price_fils,
    'is_active', p.is_active
  ) ORDER BY p.title_en), '[]'::jsonb)
    INTO v_products
    FROM public.products p
   WHERE p.id = ANY(v_d.applicable_product_ids);

  RETURN jsonb_build_object(
    'id', v_d.id,
    'code', v_d.code,
    'code_normalized', v_d.code_normalized,
    'kind', v_d.kind,
    'value', v_d.value,
    'starts_at', v_d.starts_at,
    'expires_at', v_d.expires_at,
    'min_order_fils', v_d.min_order_fils,
    'max_total_uses', v_d.max_total_uses,
    'max_uses_per_user', v_d.max_uses_per_user,
    'applies_to_all', v_d.applies_to_all,
    'applies_to_lifetime', v_d.applies_to_lifetime,
    'applicable_product_ids', to_jsonb(v_d.applicable_product_ids),
    'applicable_products', v_products,
    'is_active', v_d.is_active,
    'archived_at', v_d.archived_at,
    'notes', v_d.notes,
    'status', public._v2_discount_status_label(
      v_d.is_active,
      v_d.archived_at,
      v_d.starts_at,
      v_d.expires_at,
      v_d.max_total_uses,
      v_used
    ),
    'used_count', v_used,
    'consumed_count', v_consumed,
    'created_at', v_d.created_at,
    'updated_at', v_d.updated_at
  );
END
$$;

REVOKE ALL ON FUNCTION public.v2_admin_get_discount(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.v2_admin_get_discount(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.v2_admin_search_products_for_discount(
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := public._v2_require_admin();
  v_rows jsonb;
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 100);
BEGIN
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', products_page.id,
    'title', products_page.title_en,
    'product_type', products_page.product_type,
    'price_fils', products_page.price_fils,
    'is_active', products_page.is_active
  ) ORDER BY products_page.title_en), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT p.*
        FROM public.products p
       WHERE (
         v_search IS NULL
         OR lower(p.title_en) LIKE '%' || lower(v_search) || '%'
         OR lower(p.sku) LIKE '%' || lower(v_search) || '%'
       )
         AND p.product_type <> 'free'::public.v2_product_type
       ORDER BY p.is_active DESC, p.title_en ASC
       LIMIT v_limit
    ) products_page;

  RETURN v_rows;
END
$$;

REVOKE ALL
  ON FUNCTION public.v2_admin_search_products_for_discount(text, int)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE
  ON FUNCTION public.v2_admin_search_products_for_discount(text, int)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) Free acquisition
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.grant_free_acquisition(
  p_resource_id uuid
)
RETURNS TABLE (
  entitlement_id uuid,
  resource_id uuid,
  version_major integer,
  already_owned boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_version_id uuid;
  v_major integer;
  v_entitlement_id uuid;
  v_existed boolean := false;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT rv.id, rv.major_version
    INTO v_version_id, v_major
    FROM public.resources r
    JOIN public.resource_versions rv
      ON rv.id = r.latest_published_version_id
     AND rv.resource_id = r.id
     AND rv.published_at IS NOT NULL
   WHERE r.id = p_resource_id
     AND r.lifecycle = 'published'::public.v2_resource_lifecycle
     AND EXISTS (
       SELECT 1
         FROM public.products p
        WHERE p.resource_id = r.id
          AND p.product_type = 'free'::public.v2_product_type
          AND p.is_active
          AND p.price_fils = 0
     );

  IF v_version_id IS NULL THEN
    RAISE EXCEPTION 'resource not eligible for free acquisition'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.entitlements e
     SET revoked_at = now(),
         revoke_reason = 'expired_replaced_by_free_acquisition'
   WHERE e.user_id = v_user
     AND e.resource_id = p_resource_id
     AND e.scope = 'resource'::public.v2_entitlement_scope
     AND e.revoked_at IS NULL
     AND e.expires_at IS NOT NULL
     AND e.expires_at <= now();

  SELECT e.id
    INTO v_entitlement_id
    FROM public.entitlements e
   WHERE e.user_id = v_user
     AND e.resource_id = p_resource_id
     AND e.scope = 'resource'::public.v2_entitlement_scope
     AND e.revoked_at IS NULL
     AND (e.expires_at IS NULL OR e.expires_at > now())
   LIMIT 1;

  IF v_entitlement_id IS NOT NULL THEN
    v_existed := true;
  ELSE
    BEGIN
      INSERT INTO public.entitlements (
        user_id,
        resource_id,
        scope,
        grant_reason,
        version_major,
        granted_at
      ) VALUES (
        v_user,
        p_resource_id,
        'resource'::public.v2_entitlement_scope,
        'free_acquisition'::public.v2_grant_reason,
        v_major,
        now()
      )
      RETURNING id INTO v_entitlement_id;
    EXCEPTION
      WHEN unique_violation THEN
        SELECT e.id
          INTO v_entitlement_id
          FROM public.entitlements e
         WHERE e.user_id = v_user
           AND e.resource_id = p_resource_id
           AND e.scope = 'resource'::public.v2_entitlement_scope
           AND e.revoked_at IS NULL
         LIMIT 1;
        v_existed := true;
    END;
  END IF;

  INSERT INTO public.activity_events (
    actor_user_id,
    actor_type,
    entity_type,
    entity_id,
    action,
    metadata
  ) VALUES (
    v_user,
    'user',
    'entitlement',
    v_entitlement_id,
    CASE
      WHEN v_existed THEN 'free_acquisition_noop'
      ELSE 'free_acquisition_granted'
    END,
    jsonb_build_object(
      'resource_id', p_resource_id,
      'resource_version_id', v_version_id,
      'version_major', v_major
    )
  );

  RETURN QUERY
  SELECT v_entitlement_id, p_resource_id, v_major, v_existed;
END
$$;

REVOKE ALL ON FUNCTION public.grant_free_acquisition(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.grant_free_acquisition(uuid)
  TO authenticated;

COMMENT ON FUNCTION public.grant_free_acquisition(uuid) IS
  'Server-authoritative permanent free acquisition pinned to the explicit latest published version. Retires expired unrevoked resource grants before inserting a replacement.';

-- ---------------------------------------------------------------------------
-- 5) Retire the unsafe profile-only user creator
-- ---------------------------------------------------------------------------

-- Auth users must be created through the authenticated get-all-users Edge
-- Function. PostgreSQL cannot safely reproduce the Auth Admin API workflow,
-- and the legacy implementation produced orphan profile UUIDs rather than
-- sign-in-capable accounts.
CREATE OR REPLACE FUNCTION public.admin_create_user(
  user_email text,
  user_password text,
  user_first_name text DEFAULT 'User',
  user_last_name text DEFAULT '',
  user_role text DEFAULT 'user'
)
RETURNS json
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT json_build_object(
    'success', false,
    'error', 'endpoint_retired',
    'message', 'Use the authenticated get-all-users Edge Function.'
  )
$$;

REVOKE ALL
  ON FUNCTION public.admin_create_user(text, text, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.admin_create_user(text, text, text, text, text) IS
  'Retired fail-closed compatibility stub. Admin user creation is handled by the authenticated get-all-users Edge Function and Supabase Auth Admin API.';

-- ---------------------------------------------------------------------------
-- 6) Repair legacy callable functions after roles moved to user_roles
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.execute_response_action(
  p_execution_id uuid,
  p_action_type text,
  p_parameters jsonb,
  p_context jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_started_at timestamptz := now();
  v_execution_time_ms integer;
  v_result_details jsonb := '{}'::jsonb;
  v_execution_status text := 'success';
BEGIN
  CASE p_action_type
    WHEN 'block_ip' THEN
      v_result_details := jsonb_build_object(
        'blocked_ip', p_context->>'ip_address',
        'duration', p_parameters->>'duration_minutes'
      );
    WHEN 'disable_user' THEN
      v_result_details := jsonb_build_object(
        'disabled_user', p_context->>'user_id',
        'reason', 'automated_security_response'
      );
    WHEN 'require_mfa' THEN
      v_result_details := jsonb_build_object(
        'user_id', p_context->>'user_id',
        'mfa_required', true
      );
    WHEN 'alert_admin' THEN
      v_result_details := jsonb_build_object(
        'alert_sent', true,
        'alert_type', p_parameters->>'alert_type'
      );
    ELSE
      v_execution_status := 'failed';
      v_result_details := jsonb_build_object(
        'error', 'unknown_action_type'
      );
  END CASE;

  v_execution_time_ms :=
    floor(extract(epoch FROM (now() - v_started_at)) * 1000)::integer;

  UPDATE public.response_executions AS re
     SET execution_status = v_execution_status,
         result_details = v_result_details,
         execution_time_ms = v_execution_time_ms,
         completed_at = now()
   WHERE re.id = p_execution_id;
END
$$;

REVOKE ALL
  ON FUNCTION public.execute_response_action(uuid, text, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE
  ON FUNCTION public.execute_response_action(uuid, text, jsonb, jsonb)
  TO service_role;

CREATE OR REPLACE FUNCTION public.evaluate_access_request(
  p_user_id uuid,
  p_resource_type text,
  p_action text DEFAULT 'read',
  p_resource_id text DEFAULT NULL,
  p_context jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_role text;
  v_risk_score integer := 0;
  v_decision text := 'deny';
  v_evaluation_factors jsonb := '{}'::jsonb;
  v_ip_address text;
  v_recent_activity integer;
BEGIN
  SELECT ur.role::text
    INTO v_user_role
    FROM public.user_roles AS ur
   WHERE ur.user_id = p_user_id
   ORDER BY CASE ur.role
     WHEN 'admin'::public.app_role THEN 1
     WHEN 'jadmin'::public.app_role THEN 2
     WHEN 'prompter'::public.app_role THEN 3
     ELSE 4
   END
   LIMIT 1;

  v_user_role := coalesce(v_user_role, 'user');
  v_ip_address := p_context->>'ip_address';

  CASE v_user_role
    WHEN 'admin' THEN
      v_risk_score := v_risk_score + 10;
      v_evaluation_factors :=
        v_evaluation_factors || jsonb_build_object('role_risk', 10);
    WHEN 'jadmin' THEN
      v_risk_score := v_risk_score + 5;
      v_evaluation_factors :=
        v_evaluation_factors || jsonb_build_object('role_risk', 5);
    WHEN 'prompter' THEN
      v_risk_score := v_risk_score + 2;
      v_evaluation_factors :=
        v_evaluation_factors || jsonb_build_object('role_risk', 2);
    ELSE
      v_evaluation_factors :=
        v_evaluation_factors || jsonb_build_object('role_risk', 0);
  END CASE;

  SELECT count(*)::integer
    INTO v_recent_activity
    FROM public.security_logs AS sl
   WHERE sl.user_id = p_user_id
     AND sl.severity = 'high'
     AND sl.created_at > now() - interval '24 hours';

  IF v_recent_activity > 0 THEN
    v_risk_score := v_risk_score + (v_recent_activity * 5);
    v_evaluation_factors :=
      v_evaluation_factors
      || jsonb_build_object('recent_incidents', v_recent_activity);
  END IF;

  IF v_risk_score <= 10 THEN
    v_decision := 'allow';
  ELSIF v_risk_score <= 20 THEN
    v_decision := 'conditional';
  ELSE
    v_decision := 'deny';
  END IF;

  INSERT INTO public.access_evaluations (
    user_id,
    resource_type,
    resource_id,
    action,
    decision,
    evaluation_factors,
    risk_score,
    context_data,
    ip_address
  ) VALUES (
    p_user_id,
    p_resource_type,
    p_resource_id,
    p_action,
    v_decision,
    v_evaluation_factors,
    v_risk_score,
    p_context,
    v_ip_address
  );

  RETURN jsonb_build_object(
    'decision', v_decision,
    'risk_score', v_risk_score,
    'factors', v_evaluation_factors,
    'timestamp', now()
  );
END
$$;

REVOKE ALL
  ON FUNCTION public.evaluate_access_request(uuid, text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE
  ON FUNCTION public.evaluate_access_request(uuid, text, text, text, jsonb)
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_public_profile_safe(
  user_id_param uuid
)
RETURNS TABLE(
  id uuid,
  username text,
  role text,
  avatar_url text,
  bio text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.id,
    pr.username,
    coalesce((
      SELECT ur.role::text
        FROM public.user_roles AS ur
       WHERE ur.user_id = pr.id
       ORDER BY CASE ur.role
         WHEN 'admin'::public.app_role THEN 1
         WHEN 'jadmin'::public.app_role THEN 2
         WHEN 'prompter'::public.app_role THEN 3
         ELSE 4
       END
       LIMIT 1
    ), 'user'),
    pr.avatar_url,
    pr.bio,
    pr.created_at
  FROM public.profiles AS pr
  WHERE pr.id = user_id_param;
END
$$;

REVOKE ALL
  ON FUNCTION public.get_public_profile_safe(uuid)
  FROM PUBLIC;
GRANT EXECUTE
  ON FUNCTION public.get_public_profile_safe(uuid)
  TO anon, authenticated, service_role;

-- The legacy helper wrote every profile read into admin_audit_log. Its insert
-- guard correctly rejects non-admin actors, which inadvertently made ordinary
-- owner reads fail. Profile access belongs in the security event stream; the
-- security_logs trigger also binds user_id to auth.uid() so callers cannot
-- impersonate a different actor.
CREATE OR REPLACE FUNCTION public.log_profile_access_attempt(
  target_user_id uuid,
  access_type text,
  granted boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_headers jsonb := coalesce(
    nullif(current_setting('request.headers', true), '')::jsonb,
    '{}'::jsonb
  );
BEGIN
  INSERT INTO public.security_logs (
    user_id,
    action,
    details,
    ip_address,
    user_agent,
    severity,
    event_category
  ) VALUES (
    auth.uid(),
    'profile_access_attempt',
    jsonb_build_object(
      'target_user_id', target_user_id,
      'access_type', access_type,
      'access_granted', granted
    ),
    v_headers->>'x-forwarded-for',
    v_headers->>'user-agent',
    CASE WHEN granted THEN 'info' ELSE 'high' END,
    'data_access'
  );
END
$$;

REVOKE ALL
  ON FUNCTION public.log_profile_access_attempt(uuid, text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE
  ON FUNCTION public.log_profile_access_attempt(uuid, text, boolean)
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_user_profile_safe(
  user_id_param uuid
)
RETURNS TABLE(
  id uuid,
  first_name text,
  last_name text,
  username text,
  role text,
  avatar_url text,
  bio text,
  country text,
  membership_tier text,
  created_at timestamptz,
  phone_number text,
  social_links jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_can_access_sensitive boolean;
  v_profile public.profiles%ROWTYPE;
  v_is_owner boolean;
  v_role text;
BEGIN
  v_is_owner := auth.uid() = user_id_param;

  IF NOT v_is_owner
     AND NOT public.is_verified_admin('safe_profile_access') THEN
    PERFORM public.log_profile_access_attempt(
      user_id_param,
      'unauthorized_access',
      false
    );
    RETURN;
  END IF;

  v_can_access_sensitive :=
    v_is_owner
    OR public.can_access_sensitive_profile_data(user_id_param);

  PERFORM public.log_profile_access_attempt(
    user_id_param,
    CASE WHEN v_is_owner THEN 'owner_access' ELSE 'admin_access' END,
    true
  );

  SELECT pr.*
    INTO v_profile
    FROM public.profiles AS pr
   WHERE pr.id = user_id_param;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT ur.role::text
    INTO v_role
    FROM public.user_roles AS ur
   WHERE ur.user_id = user_id_param
   ORDER BY CASE ur.role
     WHEN 'admin'::public.app_role THEN 1
     WHEN 'jadmin'::public.app_role THEN 2
     WHEN 'prompter'::public.app_role THEN 3
     ELSE 4
   END
   LIMIT 1;

  RETURN QUERY
  SELECT
    v_profile.id,
    CASE
      WHEN v_can_access_sensitive THEN v_profile.first_name
      ELSE '***'
    END,
    CASE
      WHEN v_can_access_sensitive THEN v_profile.last_name
      ELSE '***'
    END,
    v_profile.username,
    coalesce(v_role, 'user'),
    v_profile.avatar_url,
    v_profile.bio,
    v_profile.country,
    v_profile.membership_tier,
    v_profile.created_at,
    CASE
      WHEN v_can_access_sensitive THEN v_profile.phone_number
      ELSE NULL::text
    END,
    CASE
      WHEN v_can_access_sensitive THEN v_profile.social_links
      ELSE '{}'::jsonb
    END;
END
$$;

REVOKE ALL
  ON FUNCTION public.get_user_profile_safe(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE
  ON FUNCTION public.get_user_profile_safe(uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7) Atomic, super-admin-authorized role replacement for the Edge Function
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_set_user_role_v2(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_new_role public.app_role;
  v_target_is_super_admin boolean;
  v_super_admin_count integer;
  v_previous_roles jsonb;
BEGIN
  -- Serialize role replacements so concurrent requests cannot both demote
  -- what they each observed as a non-final super admin.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('admin_set_user_role_v2', 0)
  );

  IF NOT EXISTS (
    SELECT 1
      FROM public.user_roles AS actor_role
     WHERE actor_role.user_id = p_actor_id
       AND actor_role.role = 'admin'::public.app_role
       AND actor_role.is_super_admin IS TRUE
  ) THEN
    RAISE EXCEPTION 'super_admin_required' USING ERRCODE = '42501';
  END IF;

  BEGIN
    v_new_role := p_role::public.app_role;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'invalid_role' USING ERRCODE = '22023';
  END;

  IF NOT EXISTS (
    SELECT 1
      FROM auth.users AS au
     WHERE au.id = p_target_user_id
       AND au.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'target_user_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT
    coalesce(bool_or(ur.is_super_admin IS TRUE), false),
    coalesce(jsonb_agg(jsonb_build_object(
      'role', ur.role,
      'is_super_admin', coalesce(ur.is_super_admin, false)
    ) ORDER BY ur.role::text), '[]'::jsonb)
    INTO v_target_is_super_admin, v_previous_roles
    FROM public.user_roles AS ur
   WHERE ur.user_id = p_target_user_id;

  SELECT count(*)::integer
    INTO v_super_admin_count
    FROM public.user_roles AS ur
   WHERE ur.role = 'admin'::public.app_role
     AND ur.is_super_admin IS TRUE;

  IF v_target_is_super_admin
     AND v_new_role <> 'admin'::public.app_role
     AND v_super_admin_count <= 1 THEN
    RAISE EXCEPTION 'last_super_admin_cannot_be_demoted'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.user_roles AS ur
   WHERE ur.user_id = p_target_user_id;

  INSERT INTO public.user_roles (
    user_id,
    role,
    assigned_by,
    assigned_at,
    is_super_admin
  ) VALUES (
    p_target_user_id,
    v_new_role,
    p_actor_id,
    now(),
    v_target_is_super_admin
      AND v_new_role = 'admin'::public.app_role
  );

  INSERT INTO public.activity_events (
    actor_user_id,
    actor_type,
    entity_type,
    entity_id,
    action,
    metadata
  ) VALUES (
    p_actor_id,
    'admin',
    'user',
    p_target_user_id,
    'admin_user_role_changed',
    jsonb_build_object(
      'previous_roles', v_previous_roles,
      'new_role', v_new_role,
      'preserved_super_admin',
        v_target_is_super_admin
        AND v_new_role = 'admin'::public.app_role
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', p_target_user_id,
    'role', v_new_role,
    'is_super_admin',
      v_target_is_super_admin
      AND v_new_role = 'admin'::public.app_role
  );
END
$$;

REVOKE ALL
  ON FUNCTION public.admin_set_user_role_v2(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE
  ON FUNCTION public.admin_set_user_role_v2(uuid, uuid, text)
  TO service_role;

COMMENT ON FUNCTION public.admin_set_user_role_v2(uuid, uuid, text) IS
  'Service-role-only atomic role replacement. Verifies the supplied actor against user_roles.is_super_admin and protects the final super admin.';
