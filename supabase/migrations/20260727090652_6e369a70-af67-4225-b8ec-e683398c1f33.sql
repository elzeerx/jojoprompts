-- ============================================================
-- Part 1: Repair v2_get_my_orders / v2_get_my_order_receipt
-- (row_to_jsonb -> to_jsonb). SECURITY DEFINER, search_path '',
-- authenticated + service_role EXECUTE only.
-- ============================================================

CREATE OR REPLACE FUNCTION public.v2_get_my_orders(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_limit int;
  v_offset int;
  v_rows jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT o.id, o.order_number, o.status::text AS status, o.currency,
           o.total_fils, o.paid_fils,
           COALESCE((
             SELECT SUM(r.amount_fils)
             FROM public.refunds r
             WHERE r.order_id = o.id
               AND r.status = 'processed'::public.v2_refund_status
           ), 0)::int AS refunded_fils,
           o.placed_at, o.settled_at, o.created_at,
           (SELECT COUNT(*)::int FROM public.order_items oi WHERE oi.order_id = o.id) AS item_count
    FROM public.orders o
    WHERE o.user_id = v_user
    ORDER BY o.created_at DESC
    OFFSET v_offset LIMIT v_limit
  ) t;

  RETURN jsonb_build_object('ok', true, 'orders', v_rows);
END
$function$;

REVOKE ALL ON FUNCTION public.v2_get_my_orders(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.v2_get_my_orders(integer, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.v2_get_my_order_receipt(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_order record;
  v_items jsonb;
  v_refunds jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'invalid_order_id' USING ERRCODE = '22023';
  END IF;

  SELECT o.id, o.order_number, o.status::text AS status, o.currency,
         o.subtotal_fils, o.discount_fils, o.discount_code,
         o.total_fils, o.paid_fils, o.lifetime_credit_applied_fils,
         o.placed_at, o.settled_at, o.created_at, o.user_id
    INTO v_order
    FROM public.orders o
   WHERE o.id = p_order_id
     AND o.user_id = v_user;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at), '[]'::jsonb)
    INTO v_items
  FROM (
    SELECT oi.id, oi.product_id, oi.resource_id, oi.quantity,
           oi.unit_price_fils, oi.line_total_fils, oi.paid_allocation_fils,
           oi.acquired_major_version, oi.created_at,
           r.slug AS resource_slug, r.type::text AS resource_type,
           r.title_en, r.title_ar, p.product_type::text AS product_type
      FROM public.order_items oi
      LEFT JOIN public.resources r ON r.id = oi.resource_id
      LEFT JOIN public.products p ON p.id = oi.product_id
     WHERE oi.order_id = v_order.id
  ) t;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_refunds
  FROM (
    SELECT r.id, r.status::text AS status, r.amount_fils, r.reason,
           r.requested_at, r.processed_at, r.created_at
      FROM public.refunds r
     WHERE r.order_id = v_order.id
       AND r.status IN (
         'processed'::public.v2_refund_status,
         'approved'::public.v2_refund_status,
         'failed'::public.v2_refund_status
       )
  ) t;

  RETURN jsonb_build_object(
    'ok', true,
    'order', jsonb_build_object(
      'id', v_order.id, 'order_number', v_order.order_number,
      'status', v_order.status, 'currency', v_order.currency,
      'subtotal_fils', v_order.subtotal_fils,
      'discount_fils', v_order.discount_fils,
      'discount_code', v_order.discount_code,
      'total_fils', v_order.total_fils,
      'paid_fils', v_order.paid_fils,
      'lifetime_credit_applied_fils', v_order.lifetime_credit_applied_fils,
      'placed_at', v_order.placed_at, 'settled_at', v_order.settled_at,
      'created_at', v_order.created_at
    ),
    'items', v_items,
    'refunds', v_refunds
  );
END
$function$;

REVOKE ALL ON FUNCTION public.v2_get_my_order_receipt(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.v2_get_my_order_receipt(uuid) TO authenticated, service_role;

-- ============================================================
-- Part 2: Private legacy content archive + entitlement-gated
-- prompt read policy + v2_get_entitled_resource_content RPC.
-- Idempotent, non-destructive to preserved archive data.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.resource_legacy_content_archive (
  resource_id       uuid PRIMARY KEY REFERENCES public.resources(id) ON DELETE CASCADE,
  legacy_prompt_id  uuid,
  summary_en        text,
  summary_ar        text,
  description_en    text,
  description_ar    text,
  archived_at       timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.resource_legacy_content_archive FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.resource_legacy_content_archive TO service_role;

ALTER TABLE public.resource_legacy_content_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "archive_service_role_only" ON public.resource_legacy_content_archive;
CREATE POLICY "archive_service_role_only"
  ON public.resource_legacy_content_archive
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Drop any lingering broad public/authenticated SELECT policies.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'prompts'
      AND policyname IN (
        'Anyone can read prompts',
        'Public can read prompts',
        'Authenticated can read prompts',
        'authenticated_read_prompts',
        'prompts_public_select',
        'prompts_anon_select'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.prompts', pol.policyname);
  END LOOP;
END
$$;

DROP POLICY IF EXISTS "entitled_users_can_read_prompts" ON public.prompts;
CREATE POLICY "entitled_users_can_read_prompts"
  ON public.prompts
  FOR SELECT
  TO authenticated
  USING (
    public.can_access_prompt(auth.uid(), id)
    OR EXISTS (
      SELECT 1 FROM public.resources r
      WHERE r.legacy_prompt_id = prompts.id
        AND public.v2_user_owns_resource(r.id)
    )
  );

CREATE OR REPLACE FUNCTION public.v2_get_entitled_resource_content(p_resource_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_resource record;
  v_prompt record;
  v_authorized boolean := false;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_resource_id IS NULL THEN
    RAISE EXCEPTION 'invalid_resource_id' USING ERRCODE = '22023';
  END IF;

  SELECT r.id, r.legacy_prompt_id, r.type::text AS resource_type,
         r.title_en, r.title_ar, r.lifecycle::text AS lifecycle
    INTO v_resource
    FROM public.resources r
   WHERE r.id = p_resource_id
     AND r.lifecycle IN (
       'published'::public.v2_resource_lifecycle,
       'archived'::public.v2_resource_lifecycle
     );

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  v_authorized :=
    public.v2_user_owns_resource(p_resource_id)
    OR public.has_role(v_user, 'admin'::public.app_role)
    OR public.has_role(v_user, 'jadmin'::public.app_role);

  IF NOT v_authorized THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_entitled');
  END IF;

  IF v_resource.legacy_prompt_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'kind', 'package',
      'resource_id', v_resource.id,
      'prompt_text', null,
      'prompt_text_ar', null
    );
  END IF;

  SELECT p.prompt_text, p.prompt_text_ar
    INTO v_prompt
    FROM public.prompts p
   WHERE p.id = v_resource.legacy_prompt_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'content_missing');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'kind', 'prompt',
    'resource_id', v_resource.id,
    'resource_type', v_resource.resource_type,
    'prompt_text', v_prompt.prompt_text,
    'prompt_text_ar', v_prompt.prompt_text_ar
  );
END
$function$;

REVOKE ALL ON FUNCTION public.v2_get_entitled_resource_content(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.v2_get_entitled_resource_content(uuid) TO authenticated, service_role;