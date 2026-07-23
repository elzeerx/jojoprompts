-- Phase 5.1: Admin V2 commerce read RPCs (forward-only, additive)
-- All functions: SECURITY DEFINER, actor from auth.uid(), require has_role(actor,'admin').
-- Grants: authenticated only. Revoke PUBLIC/anon/service_role.

-- Supporting indexes (justified by list/recovery queries below)
CREATE INDEX IF NOT EXISTS idx_payment_events_received_at
  ON public.payment_events (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_state_updated
  ON public.payment_attempts (provider_submission_state, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_refunds_state_updated
  ON public.refunds (provider_submission_state, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_action_created
  ON public.activity_events (action, created_at DESC);

-- Helper: mask an email address for list views
CREATE OR REPLACE FUNCTION public._v2_mask_email(p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_email IS NULL OR position('@' in p_email) = 0 THEN NULL
    ELSE substr(split_part(p_email,'@',1),1,2) || '***@' || split_part(p_email,'@',2)
  END
$$;
REVOKE ALL ON FUNCTION public._v2_mask_email(text) FROM PUBLIC;

-- Helper: enforce admin caller. Returns actor uid.
CREATE OR REPLACE FUNCTION public._v2_require_admin()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.has_role(v_actor, 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN v_actor;
END
$$;
REVOKE ALL ON FUNCTION public._v2_require_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._v2_require_admin() TO authenticated;

-- Bounded limit helper
CREATE OR REPLACE FUNCTION public._v2_bounded_limit(p_limit int, p_max int DEFAULT 200)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$ SELECT LEAST(GREATEST(COALESCE(p_limit, 50), 1), p_max) $$;
REVOKE ALL ON FUNCTION public._v2_bounded_limit(int,int) FROM PUBLIC;

-- =========================================================================
-- 1) v2_admin_order_metrics
-- =========================================================================
CREATE OR REPLACE FUNCTION public.v2_admin_order_metrics(p_period_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
  v_from timestamptz;
  v_days int := LEAST(GREATEST(COALESCE(p_period_days, 30), 1), 365);
  v_result jsonb;
BEGIN
  v_actor := public._v2_require_admin();
  v_from := now() - make_interval(days => v_days);

  SELECT jsonb_build_object(
    'period_days', v_days,
    'from', v_from,
    'to', now(),
    'currency', 'KWD',
    'revenue_fils', COALESCE(SUM(o.paid_fils) FILTER (WHERE o.status = 'paid' AND o.settled_at >= v_from), 0),
    'orders_paid', COUNT(*) FILTER (WHERE o.status = 'paid' AND o.settled_at >= v_from),
    'orders_pending', COUNT(*) FILTER (WHERE o.status = 'pending' AND o.placed_at >= v_from),
    'orders_failed', COUNT(*) FILTER (WHERE o.status = 'failed' AND o.updated_at >= v_from),
    'orders_refunded', COUNT(*) FILTER (WHERE o.status IN ('refunded','partially_refunded') AND o.updated_at >= v_from),
    'refunds_processed_fils', (
      SELECT COALESCE(SUM(r.amount_fils),0) FROM public.refunds r
      WHERE r.status = 'processed' AND r.processed_at >= v_from
    ),
    'refunds_pending', (
      SELECT COUNT(*) FROM public.refunds r
      WHERE r.status IN ('pending','approved') AND r.requested_at >= v_from
    ),
    'lifetime_direct_unlocks', (
      SELECT COUNT(*) FROM public.entitlements e
      WHERE e.scope = 'library' AND e.grant_reason = 'lifetime_purchase'
        AND e.revoked_at IS NULL AND e.granted_at >= v_from
    ),
    'lifetime_threshold_unlocks', (
      SELECT COUNT(*) FROM public.entitlements e
      WHERE e.scope = 'library' AND e.grant_reason = 'lifetime_threshold'
        AND e.revoked_at IS NULL AND e.granted_at >= v_from
    )
  )
  INTO v_result
  FROM public.orders o;

  RETURN v_result;
END
$$;
REVOKE ALL ON FUNCTION public.v2_admin_order_metrics(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_admin_order_metrics(int) TO authenticated;

-- =========================================================================
-- 2) v2_admin_list_orders
-- =========================================================================
DROP FUNCTION IF EXISTS public.v2_admin_list_orders(text,text,timestamptz,timestamptz,int,int);
CREATE OR REPLACE FUNCTION public.v2_admin_list_orders(
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
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
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
  v_total bigint;
  v_rows jsonb;
  v_search text := NULLIF(trim(coalesce(p_search,'')), '');
BEGIN
  v_actor := public._v2_require_admin();
  v_limit := public._v2_bounded_limit(p_limit, 200);

  WITH filt AS (
    SELECT o.*, p.email AS user_email
    FROM public.orders o
    LEFT JOIN public.profiles p ON p.id = o.user_id
    WHERE (p_status IS NULL OR o.status::text = p_status)
      AND (p_date_from IS NULL OR o.created_at >= p_date_from)
      AND (p_date_to IS NULL OR o.created_at <= p_date_to)
      AND (
        v_search IS NULL
        OR o.order_number ILIKE '%'||v_search||'%'
        OR o.provider_reference ILIKE '%'||v_search||'%'
        OR p.email ILIKE '%'||v_search||'%'
      )
  ), counted AS (
    SELECT COUNT(*) AS c FROM filt
  ), page AS (
    SELECT * FROM filt ORDER BY created_at DESC LIMIT v_limit OFFSET v_offset
  )
  SELECT (SELECT c FROM counted),
         COALESCE(jsonb_agg(jsonb_build_object(
           'id', p.id,
           'order_number', p.order_number,
           'status', p.status,
           'currency', p.currency,
           'subtotal_fils', p.subtotal_fils,
           'discount_fils', p.discount_fils,
           'total_fils', p.total_fils,
           'paid_fils', p.paid_fils,
           'lifetime_credit_applied_fils', p.lifetime_credit_applied_fils,
           'provider', p.provider,
           'provider_reference', p.provider_reference,
           'user_id', p.user_id,
           'user_email_masked', public._v2_mask_email(p.user_email),
           'placed_at', p.placed_at,
           'settled_at', p.settled_at,
           'created_at', p.created_at,
           'attention', CASE
             WHEN p.status = 'pending' AND p.created_at < now() - interval '2 hours' THEN 'stale_pending'
             WHEN p.status = 'failed' THEN 'failed'
             WHEN p.status = 'partially_refunded' THEN 'partial_refund'
             ELSE NULL
           END
         ) ORDER BY p.created_at DESC), '[]'::jsonb)
  INTO v_total, v_rows
  FROM page p;

  RETURN jsonb_build_object('total_count', v_total, 'rows', v_rows, 'limit', v_limit, 'offset', v_offset);
END
$$;
REVOKE ALL ON FUNCTION public.v2_admin_list_orders(text,text,timestamptz,timestamptz,int,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_admin_list_orders(text,text,timestamptz,timestamptz,int,int) TO authenticated;

-- =========================================================================
-- 3) v2_admin_get_order_detail
-- =========================================================================
CREATE OR REPLACE FUNCTION public.v2_admin_get_order_detail(p_order_id uuid)
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
    'id', o.id, 'order_number', o.order_number, 'status', o.status,
    'currency', o.currency, 'subtotal_fils', o.subtotal_fils, 'discount_fils', o.discount_fils,
    'discount_code', o.discount_code, 'total_fils', o.total_fils, 'paid_fils', o.paid_fils,
    'lifetime_credit_applied_fils', o.lifetime_credit_applied_fils,
    'provider', o.provider, 'provider_reference', o.provider_reference,
    'idempotency_key', o.idempotency_key,
    'placed_at', o.placed_at, 'settled_at', o.settled_at,
    'created_at', o.created_at, 'updated_at', o.updated_at,
    'user_id', o.user_id, 'user_email', p.email,
    'user_name', trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,''))
  )
  INTO v_order
  FROM public.orders o
  LEFT JOIN public.profiles p ON p.id = o.user_id
  WHERE o.id = p_order_id;

  IF v_order IS NULL THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', oi.id, 'product_id', oi.product_id, 'resource_id', oi.resource_id,
    'quantity', oi.quantity, 'unit_price_fils', oi.unit_price_fils,
    'line_total_fils', oi.line_total_fils, 'paid_allocation_fils', oi.paid_allocation_fils,
    'resource_version_id', oi.resource_version_id, 'acquired_major_version', oi.acquired_major_version,
    'product_sku', pr.sku, 'product_type', pr.product_type,
    'resource_title', rs.title, 'resource_type', rs.resource_type
  ) ORDER BY oi.created_at), '[]'::jsonb)
  INTO v_items
  FROM public.order_items oi
  LEFT JOIN public.products pr ON pr.id = oi.product_id
  LEFT JOIN public.resources rs ON rs.id = oi.resource_id
  WHERE oi.order_id = p_order_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', pa.id, 'provider', pa.provider, 'status', pa.status,
    'merchant_reference', pa.merchant_reference, 'track_id', pa.track_id,
    'session_id', pa.session_id, 'provider_order_id', pa.provider_order_id,
    'expected_amount_fils', pa.expected_amount_fils, 'currency', pa.currency,
    'provider_submission_state', pa.provider_submission_state,
    'last_provider_http_status', pa.last_provider_http_status,
    'last_checked_at', pa.last_checked_at, 'next_check_after', pa.next_check_after,
    'check_count', pa.check_count,
    'created_at', pa.created_at, 'updated_at', pa.updated_at
  ) ORDER BY pa.created_at DESC), '[]'::jsonb)
  INTO v_attempts
  FROM public.payment_attempts pa WHERE pa.order_id = p_order_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', pe.id, 'provider', pe.provider, 'event_type', pe.event_type,
    'external_event_id', pe.external_event_id, 'amount_fils', pe.amount_fils,
    'currency', pe.currency, 'received_at', pe.received_at
  ) ORDER BY pe.received_at DESC), '[]'::jsonb)
  INTO v_events
  FROM public.payment_events pe WHERE pe.order_id = p_order_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id, 'status', r.status, 'amount_fils', r.amount_fils,
    'reason', r.reason, 'provider_reference', r.provider_reference,
    'provider_refund_order_id', r.provider_refund_order_id,
    'provider_submission_state', r.provider_submission_state,
    'requested_at', r.requested_at, 'processed_at', r.processed_at,
    'items', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'order_item_id', ri.order_item_id, 'amount_fils', ri.amount_fils
      )), '[]'::jsonb) FROM public.refund_items ri WHERE ri.refund_id = r.id
    )
  ) ORDER BY r.requested_at DESC), '[]'::jsonb)
  INTO v_refunds
  FROM public.refunds r WHERE r.order_id = p_order_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', e.id, 'scope', e.scope, 'resource_id', e.resource_id,
    'grant_reason', e.grant_reason, 'source_order_item_id', e.source_order_item_id,
    'granted_at', e.granted_at, 'revoked_at', e.revoked_at,
    'revoke_reason', e.revoke_reason, 'expires_at', e.expires_at,
    'version_major', e.version_major
  ) ORDER BY e.granted_at DESC), '[]'::jsonb)
  INTO v_entitlements
  FROM public.entitlements e WHERE e.order_id = p_order_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', lc.id, 'amount_fils', lc.amount_fils, 'reason', lc.reason,
    'refund_id', lc.refund_id, 'occurred_at', lc.occurred_at
  ) ORDER BY lc.occurred_at DESC), '[]'::jsonb)
  INTO v_credit
  FROM public.lifetime_credit_entries lc WHERE lc.order_id = p_order_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', a.id, 'action', a.action, 'actor_type', a.actor_type,
    'entity_type', a.entity_type, 'entity_id', a.entity_id,
    'metadata', a.metadata, 'created_at', a.created_at
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
REVOKE ALL ON FUNCTION public.v2_admin_get_order_detail(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_admin_get_order_detail(uuid) TO authenticated;

-- =========================================================================
-- 4) v2_admin_list_payment_events (rich signature, replaces old 3-arg helper via new name reuse)
-- =========================================================================
DROP FUNCTION IF EXISTS public.v2_admin_list_payment_events(uuid,int,int);
CREATE OR REPLACE FUNCTION public.v2_admin_list_payment_events(
  p_event_type text DEFAULT NULL,
  p_provider text DEFAULT NULL,
  p_order_id uuid DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
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
  v_limit int; v_offset int := GREATEST(COALESCE(p_offset,0),0);
  v_total bigint; v_rows jsonb;
BEGIN
  v_actor := public._v2_require_admin();
  v_limit := public._v2_bounded_limit(p_limit, 200);

  WITH filt AS (
    SELECT pe.*, o.order_number
    FROM public.payment_events pe
    LEFT JOIN public.orders o ON o.id = pe.order_id
    WHERE (p_event_type IS NULL OR pe.event_type::text = p_event_type)
      AND (p_provider IS NULL OR pe.provider = p_provider)
      AND (p_order_id IS NULL OR pe.order_id = p_order_id)
      AND (p_date_from IS NULL OR pe.received_at >= p_date_from)
      AND (p_date_to IS NULL OR pe.received_at <= p_date_to)
  ), page AS (
    SELECT * FROM filt ORDER BY received_at DESC LIMIT v_limit OFFSET v_offset
  )
  SELECT (SELECT COUNT(*) FROM filt),
         COALESCE(jsonb_agg(jsonb_build_object(
           'id', p.id, 'order_id', p.order_id, 'order_number', p.order_number,
           'provider', p.provider, 'event_type', p.event_type,
           'external_event_id', p.external_event_id,
           'amount_fils', p.amount_fils, 'currency', p.currency,
           'received_at', p.received_at
         ) ORDER BY p.received_at DESC), '[]'::jsonb)
  INTO v_total, v_rows
  FROM page p;

  RETURN jsonb_build_object('total_count', v_total, 'rows', v_rows, 'limit', v_limit, 'offset', v_offset);
END
$$;
REVOKE ALL ON FUNCTION public.v2_admin_list_payment_events(text,text,uuid,timestamptz,timestamptz,int,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_admin_list_payment_events(text,text,uuid,timestamptz,timestamptz,int,int) TO authenticated;

-- Detail RPC that returns a single event with sanitized payload
CREATE OR REPLACE FUNCTION public.v2_admin_get_payment_event(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
  v_row jsonb;
  v_rejections jsonb;
BEGIN
  v_actor := public._v2_require_admin();
  SELECT jsonb_build_object(
    'id', pe.id, 'order_id', pe.order_id, 'provider', pe.provider,
    'event_type', pe.event_type, 'external_event_id', pe.external_event_id,
    'amount_fils', pe.amount_fils, 'currency', pe.currency,
    'received_at', pe.received_at,
    'sanitized_payload', pe.raw_payload
  ) INTO v_row FROM public.payment_events pe WHERE pe.id = p_event_id;

  IF v_row IS NULL THEN
    RAISE EXCEPTION 'event_not_found' USING ERRCODE='P0002';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', a.id, 'action', a.action, 'metadata', a.metadata, 'created_at', a.created_at
  ) ORDER BY a.created_at DESC), '[]'::jsonb)
  INTO v_rejections
  FROM public.activity_events a
  WHERE a.entity_id = (v_row->>'order_id')::uuid
    AND a.action LIKE 'v2_upayments_verification_rejection%';

  RETURN jsonb_build_object('event', v_row, 'related_rejections', v_rejections);
END
$$;
REVOKE ALL ON FUNCTION public.v2_admin_get_payment_event(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_admin_get_payment_event(uuid) TO authenticated;

-- =========================================================================
-- 5) v2_admin_list_entitlements
-- =========================================================================
CREATE OR REPLACE FUNCTION public.v2_admin_list_entitlements(
  p_scope text DEFAULT NULL,
  p_state text DEFAULT NULL,        -- 'active' | 'revoked' | 'expired' | NULL
  p_reason text DEFAULT NULL,
  p_search text DEFAULT NULL,       -- user email or resource title
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
  v_limit int; v_offset int := GREATEST(COALESCE(p_offset,0),0);
  v_total bigint; v_rows jsonb;
  v_search text := NULLIF(trim(coalesce(p_search,'')), '');
BEGIN
  v_actor := public._v2_require_admin();
  v_limit := public._v2_bounded_limit(p_limit, 200);

  WITH filt AS (
    SELECT e.*, p.email AS user_email, r.title AS resource_title, r.resource_type
    FROM public.entitlements e
    LEFT JOIN public.profiles p ON p.id = e.user_id
    LEFT JOIN public.resources r ON r.id = e.resource_id
    WHERE (p_scope IS NULL OR e.scope::text = p_scope)
      AND (p_reason IS NULL OR e.grant_reason::text = p_reason)
      AND (
        p_state IS NULL
        OR (p_state='active'  AND e.revoked_at IS NULL AND (e.expires_at IS NULL OR e.expires_at > now()))
        OR (p_state='revoked' AND e.revoked_at IS NOT NULL)
        OR (p_state='expired' AND e.expires_at IS NOT NULL AND e.expires_at <= now() AND e.revoked_at IS NULL)
      )
      AND (
        v_search IS NULL
        OR p.email ILIKE '%'||v_search||'%'
        OR r.title ILIKE '%'||v_search||'%'
      )
  ), page AS (
    SELECT * FROM filt ORDER BY granted_at DESC LIMIT v_limit OFFSET v_offset
  )
  SELECT (SELECT COUNT(*) FROM filt),
         COALESCE(jsonb_agg(jsonb_build_object(
           'id', p.id, 'user_id', p.user_id,
           'user_email_masked', public._v2_mask_email(p.user_email),
           'scope', p.scope, 'resource_id', p.resource_id, 'resource_title', p.resource_title,
           'resource_type', p.resource_type,
           'grant_reason', p.grant_reason, 'order_id', p.order_id,
           'source_order_item_id', p.source_order_item_id,
           'granted_at', p.granted_at, 'revoked_at', p.revoked_at,
           'revoke_reason', p.revoke_reason, 'expires_at', p.expires_at,
           'version_major', p.version_major,
           'state', CASE
             WHEN p.revoked_at IS NOT NULL THEN 'revoked'
             WHEN p.expires_at IS NOT NULL AND p.expires_at <= now() THEN 'expired'
             ELSE 'active'
           END
         ) ORDER BY p.granted_at DESC), '[]'::jsonb)
  INTO v_total, v_rows
  FROM page p;

  RETURN jsonb_build_object('total_count', v_total, 'rows', v_rows, 'limit', v_limit, 'offset', v_offset);
END
$$;
REVOKE ALL ON FUNCTION public.v2_admin_list_entitlements(text,text,text,text,int,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_admin_list_entitlements(text,text,text,text,int,int) TO authenticated;

-- =========================================================================
-- 6) v2_admin_list_refunds (rich signature; replaces old (status,order_id,limit,offset))
-- =========================================================================
DROP FUNCTION IF EXISTS public.v2_admin_list_refunds(text,uuid,int,int);
CREATE OR REPLACE FUNCTION public.v2_admin_list_refunds(
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
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
  v_limit int; v_offset int := GREATEST(COALESCE(p_offset,0),0);
  v_total bigint; v_rows jsonb;
  v_search text := NULLIF(trim(coalesce(p_search,'')), '');
BEGIN
  v_actor := public._v2_require_admin();
  v_limit := public._v2_bounded_limit(p_limit, 200);

  WITH filt AS (
    SELECT r.*, o.order_number, p.email AS user_email
    FROM public.refunds r
    LEFT JOIN public.orders o ON o.id = r.order_id
    LEFT JOIN public.profiles p ON p.id = r.user_id
    WHERE (p_status IS NULL OR r.status::text = p_status)
      AND (p_date_from IS NULL OR r.requested_at >= p_date_from)
      AND (p_date_to IS NULL OR r.requested_at <= p_date_to)
      AND (
        v_search IS NULL
        OR o.order_number ILIKE '%'||v_search||'%'
        OR r.provider_reference ILIKE '%'||v_search||'%'
        OR p.email ILIKE '%'||v_search||'%'
      )
  ), page AS (
    SELECT * FROM filt ORDER BY requested_at DESC LIMIT v_limit OFFSET v_offset
  )
  SELECT (SELECT COUNT(*) FROM filt),
         COALESCE(jsonb_agg(jsonb_build_object(
           'id', p.id, 'order_id', p.order_id, 'order_number', p.order_number,
           'user_id', p.user_id, 'user_email_masked', public._v2_mask_email(p.user_email),
           'status', p.status, 'amount_fils', p.amount_fils, 'reason', p.reason,
           'provider_reference', p.provider_reference,
           'provider_refund_order_id', p.provider_refund_order_id,
           'provider_submission_state', p.provider_submission_state,
           'requested_at', p.requested_at, 'processed_at', p.processed_at,
           'next_check_after', p.next_check_after,
           'last_checked_at', p.last_checked_at
         ) ORDER BY p.requested_at DESC), '[]'::jsonb)
  INTO v_total, v_rows
  FROM page p;

  RETURN jsonb_build_object('total_count', v_total, 'rows', v_rows, 'limit', v_limit, 'offset', v_offset);
END
$$;
REVOKE ALL ON FUNCTION public.v2_admin_list_refunds(text,text,timestamptz,timestamptz,int,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_admin_list_refunds(text,text,timestamptz,timestamptz,int,int) TO authenticated;

-- =========================================================================
-- 7) v2_admin_list_recovery
-- =========================================================================
CREATE OR REPLACE FUNCTION public.v2_admin_list_recovery(
  p_kind text DEFAULT NULL,         -- filter by kind key
  p_min_age_minutes int DEFAULT 0,
  p_limit int DEFAULT 100,
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
  v_limit int; v_offset int := GREATEST(COALESCE(p_offset,0),0);
  v_min interval := make_interval(mins => GREATEST(COALESCE(p_min_age_minutes,0),0));
  v_total bigint; v_rows jsonb;
BEGIN
  v_actor := public._v2_require_admin();
  v_limit := public._v2_bounded_limit(p_limit, 200);

  WITH unioned AS (
    -- charge submission unknown
    SELECT 'charge_submission_unknown' AS kind, 'high' AS severity,
           pa.order_id AS order_id, NULL::uuid AS refund_id,
           pa.updated_at AS last_activity_at,
           jsonb_build_object('attempt_id', pa.id, 'provider', pa.provider,
             'http_status', pa.last_provider_http_status,
             'submission_state', pa.provider_submission_state) AS meta,
           'Payment submission state is unknown — verify with provider status.' AS reason,
           pa.last_checked_at AS last_checked_at
    FROM public.payment_attempts pa
    WHERE pa.provider_submission_state = 'submission_unknown'

    UNION ALL
    -- stale pending/submitting attempts (> 2h)
    SELECT 'stale_payment_attempt', 'medium',
           pa.order_id, NULL,
           pa.updated_at,
           jsonb_build_object('attempt_id', pa.id, 'status', pa.status,
             'submission_state', pa.provider_submission_state),
           'Payment attempt has been pending too long.',
           pa.last_checked_at
    FROM public.payment_attempts pa
    WHERE pa.provider_submission_state IN ('pending','submitting','submitted')
      AND pa.updated_at < now() - interval '2 hours'

    UNION ALL
    -- refund submission unknown
    SELECT 'refund_submission_unknown', 'high',
           r.order_id, r.id,
           r.updated_at,
           jsonb_build_object('provider_ref', r.provider_reference,
             'http_status', r.last_provider_http_status),
           'Refund submission state is unknown — re-check provider status.',
           r.last_checked_at
    FROM public.refunds r
    WHERE r.provider_submission_state = 'submission_unknown'

    UNION ALL
    -- refunds awaiting status
    SELECT 'refund_awaiting_status', 'medium',
           r.order_id, r.id,
           r.updated_at,
           jsonb_build_object('status', r.status, 'submission_state', r.provider_submission_state),
           'Refund awaiting provider terminal status.',
           r.last_checked_at
    FROM public.refunds r
    WHERE r.status IN ('approved') AND r.provider_submission_state = 'submitted'
      AND r.updated_at < now() - interval '30 minutes'

    UNION ALL
    -- refunds failed
    SELECT 'refund_failed', 'high',
           r.order_id, r.id,
           r.updated_at,
           jsonb_build_object('status', r.status),
           'Refund reported failed by provider.',
           r.last_checked_at
    FROM public.refunds r
    WHERE r.status = 'failed'

    UNION ALL
    -- provider correlation/verification rejections
    SELECT 'verification_rejection', 'high',
           a.entity_id, NULL,
           a.created_at,
           a.metadata,
           'Provider verification rejection recorded — inspect payload.',
           NULL
    FROM public.activity_events a
    WHERE a.action LIKE 'v2_upayments_verification_rejection%'
      AND a.entity_type = 'order'
  ), filt AS (
    SELECT * FROM unioned
    WHERE (p_kind IS NULL OR kind = p_kind)
      AND (last_activity_at IS NULL OR last_activity_at <= now() - v_min)
  ), page AS (
    SELECT u.*, o.order_number, o.status AS order_status,
           pf.email AS user_email, o.user_id
    FROM filt u
    LEFT JOIN public.orders o ON o.id = u.order_id
    LEFT JOIN public.profiles pf ON pf.id = o.user_id
    ORDER BY u.last_activity_at DESC NULLS LAST
    LIMIT v_limit OFFSET v_offset
  )
  SELECT (SELECT COUNT(*) FROM filt),
         COALESCE(jsonb_agg(jsonb_build_object(
           'kind', p.kind, 'severity', p.severity,
           'order_id', p.order_id, 'order_number', p.order_number, 'order_status', p.order_status,
           'refund_id', p.refund_id,
           'user_id', p.user_id, 'user_email_masked', public._v2_mask_email(p.user_email),
           'age_seconds', EXTRACT(EPOCH FROM (now() - p.last_activity_at))::bigint,
           'last_activity_at', p.last_activity_at,
           'last_checked_at', p.last_checked_at,
           'reason', p.reason,
           'meta', p.meta
         ) ORDER BY p.last_activity_at DESC NULLS LAST), '[]'::jsonb)
  INTO v_total, v_rows
  FROM page p;

  RETURN jsonb_build_object('total_count', v_total, 'rows', v_rows, 'limit', v_limit, 'offset', v_offset);
END
$$;
REVOKE ALL ON FUNCTION public.v2_admin_list_recovery(text,int,int,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_admin_list_recovery(text,int,int,int) TO authenticated;
