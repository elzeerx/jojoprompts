-- Revoke inherited public-schema grants on the outbox table
REVOKE ALL ON TABLE public.v2_order_receipt_deliveries FROM PUBLIC;
REVOKE ALL ON TABLE public.v2_order_receipt_deliveries FROM anon;
REVOKE ALL ON TABLE public.v2_order_receipt_deliveries FROM authenticated;

-- Authenticated needs SELECT so the admin-read RLS policy can evaluate.
GRANT SELECT ON TABLE public.v2_order_receipt_deliveries TO authenticated;

-- Service role retains full mutation privileges (edge functions).
GRANT ALL ON TABLE public.v2_order_receipt_deliveries TO service_role;

-- Helper functions: revoke execute from PUBLIC/anon/authenticated.
REVOKE ALL ON FUNCTION public._v2_touch_receipt_delivery_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._v2_enqueue_order_receipt() FROM PUBLIC, anon, authenticated;