
-- =========================================================================
-- V2 Commerce Phase 1 — additive migration
-- =========================================================================

-- A5) orders / refunds column additions ----------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS lifetime_credit_applied_fils integer NOT NULL DEFAULT 0
    CHECK (lifetime_credit_applied_fils >= 0);

ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS provider_refund_order_id text,
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS refunds_provider_refund_order_id_uidx
  ON public.refunds (provider_refund_order_id)
  WHERE provider_refund_order_id IS NOT NULL;

-- A1) payment_attempts ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider              text NOT NULL CHECK (provider IN ('upayments','paypal','internal')),
  merchant_reference    text NOT NULL,
  track_id              text,
  session_id            text,
  provider_order_id     text,
  expected_amount_fils  integer NOT NULL CHECK (expected_amount_fils >= 0),
  currency              text NOT NULL DEFAULT 'KWD' CHECK (currency = 'KWD'),
  status                text NOT NULL DEFAULT 'created'
                        CHECK (status IN ('created','redirect_ready','pending','verified_paid',
                                          'failed','cancelled','mismatch','error')),
  checkout_url          text,
  request_payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified_payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_checked_at       timestamptz,
  next_check_after      timestamptz,
  check_count           integer NOT NULL DEFAULT 0 CHECK (check_count >= 0),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_attempts_merchant_reference_len CHECK (char_length(merchant_reference) <= 40)
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_merchant_reference_uidx
  ON public.payment_attempts (merchant_reference);
CREATE INDEX IF NOT EXISTS payment_attempts_order_idx
  ON public.payment_attempts (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_attempts_status_idx
  ON public.payment_attempts (status);
CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_track_id_uidx
  ON public.payment_attempts (provider, track_id) WHERE track_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_session_id_uidx
  ON public.payment_attempts (provider, session_id) WHERE session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_provider_order_id_uidx
  ON public.payment_attempts (provider, provider_order_id) WHERE provider_order_id IS NOT NULL;

-- A2) refund_items -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.refund_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id      uuid NOT NULL REFERENCES public.refunds(id) ON DELETE CASCADE,
  order_item_id  uuid NOT NULL REFERENCES public.order_items(id) ON DELETE RESTRICT,
  amount_fils    integer NOT NULL CHECK (amount_fils > 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT refund_items_unique_pair UNIQUE (refund_id, order_item_id)
);
CREATE INDEX IF NOT EXISTS refund_items_order_item_idx ON public.refund_items (order_item_id);

-- A3) v2 discount codes & redemptions -----------------------------------
CREATE TABLE IF NOT EXISTS public.v2_discount_codes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code               text NOT NULL,
  code_normalized    text GENERATED ALWAYS AS (lower(code)) STORED,
  kind               text NOT NULL CHECK (kind IN ('percent','fixed_fils')),
  value              integer NOT NULL CHECK (value > 0),
  starts_at          timestamptz,
  expires_at         timestamptz,
  max_total_uses     integer CHECK (max_total_uses IS NULL OR max_total_uses > 0),
  max_uses_per_user  integer CHECK (max_uses_per_user IS NULL OR max_uses_per_user > 0),
  min_order_fils     integer NOT NULL DEFAULT 0 CHECK (min_order_fils >= 0),
  applies_to_all     boolean NOT NULL DEFAULT true,
  is_active          boolean NOT NULL DEFAULT true,
  notes              text,
  created_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT v2_discount_percent_bounds
    CHECK (kind <> 'percent' OR (value BETWEEN 1 AND 100))
);
CREATE UNIQUE INDEX IF NOT EXISTS v2_discount_codes_code_norm_uidx
  ON public.v2_discount_codes (code_normalized);
CREATE INDEX IF NOT EXISTS v2_discount_codes_active_idx
  ON public.v2_discount_codes (is_active, expires_at);

CREATE TABLE IF NOT EXISTS public.v2_discount_redemptions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code_id   uuid NOT NULL REFERENCES public.v2_discount_codes(id) ON DELETE RESTRICT,
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id           uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount_discount_fils integer NOT NULL CHECK (amount_discount_fils >= 0),
  status             text NOT NULL DEFAULT 'reserved'
                     CHECK (status IN ('reserved','consumed','released')),
  reserved_at        timestamptz NOT NULL DEFAULT now(),
  consumed_at        timestamptz,
  released_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS v2_discount_redemptions_order_uidx
  ON public.v2_discount_redemptions (order_id);
CREATE INDEX IF NOT EXISTS v2_discount_redemptions_user_active_idx
  ON public.v2_discount_redemptions (discount_code_id, user_id)
  WHERE status IN ('reserved','consumed');
CREATE INDEX IF NOT EXISTS v2_discount_redemptions_code_active_idx
  ON public.v2_discount_redemptions (discount_code_id)
  WHERE status IN ('reserved','consumed');

-- A6) active ownership/idempotency indexes (history-preserving) ----------
-- entitlements_one_active_per_user_resource and entitlements_one_active_library_per_user
-- already exist (verified). Add per-order dedupe for grants attributable to an order.
CREATE UNIQUE INDEX IF NOT EXISTS entitlements_active_per_order_resource_uidx
  ON public.entitlements (order_id, resource_id)
  WHERE revoked_at IS NULL AND scope = 'resource' AND order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS entitlements_active_library_per_order_uidx
  ON public.entitlements (order_id)
  WHERE revoked_at IS NULL AND scope = 'library' AND order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS lifetime_credit_entries_order_positive_uidx
  ON public.lifetime_credit_entries (order_id)
  WHERE order_id IS NOT NULL AND refund_id IS NULL AND amount_fils > 0;

CREATE UNIQUE INDEX IF NOT EXISTS lifetime_credit_entries_refund_negative_uidx
  ON public.lifetime_credit_entries (refund_id)
  WHERE refund_id IS NOT NULL AND amount_fils < 0;

-- Triggers to keep updated_at fresh (reuse existing helper if present) --
DO $$ BEGIN
  PERFORM 1 FROM pg_proc WHERE proname='update_platform_updated_at' AND pronamespace='public'::regnamespace;
END $$;

DROP TRIGGER IF EXISTS trg_payment_attempts_updated_at ON public.payment_attempts;
CREATE TRIGGER trg_payment_attempts_updated_at BEFORE UPDATE ON public.payment_attempts
  FOR EACH ROW EXECUTE FUNCTION public.update_platform_updated_at();

DROP TRIGGER IF EXISTS trg_v2_discount_codes_updated_at ON public.v2_discount_codes;
CREATE TRIGGER trg_v2_discount_codes_updated_at BEFORE UPDATE ON public.v2_discount_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_platform_updated_at();

DROP TRIGGER IF EXISTS trg_v2_discount_redemptions_updated_at ON public.v2_discount_redemptions;
CREATE TRIGGER trg_v2_discount_redemptions_updated_at BEFORE UPDATE ON public.v2_discount_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.update_platform_updated_at();

-- =========================================================================
-- Grants & RLS
-- =========================================================================

-- payment_attempts: no direct SELECT to customers (contains raw provider payloads).
GRANT SELECT ON public.payment_attempts TO authenticated; -- rows filtered via RLS; column-level revoke below
GRANT ALL    ON public.payment_attempts TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.payment_attempts FROM authenticated, anon;
-- Hide raw payload columns from customers even when RLS grants row access.
REVOKE SELECT (request_payload, response_payload, verified_payload)
  ON public.payment_attempts FROM authenticated, anon, PUBLIC;

ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_attempts_owner_read ON public.payment_attempts;
CREATE POLICY payment_attempts_owner_read ON public.payment_attempts
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = payment_attempts.order_id AND o.user_id = auth.uid()));
DROP POLICY IF EXISTS payment_attempts_admin_read ON public.payment_attempts;
CREATE POLICY payment_attempts_admin_read ON public.payment_attempts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- refund_items
GRANT SELECT ON public.refund_items TO authenticated;
GRANT ALL    ON public.refund_items TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.refund_items FROM authenticated, anon;
ALTER TABLE public.refund_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS refund_items_owner_read ON public.refund_items;
CREATE POLICY refund_items_owner_read ON public.refund_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.refunds r WHERE r.id = refund_items.refund_id AND r.user_id = auth.uid()));
DROP POLICY IF EXISTS refund_items_admin_read ON public.refund_items;
CREATE POLICY refund_items_admin_read ON public.refund_items
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- v2_discount_codes: admin-only
GRANT SELECT ON public.v2_discount_codes TO authenticated;
GRANT ALL    ON public.v2_discount_codes TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.v2_discount_codes FROM authenticated, anon;
ALTER TABLE public.v2_discount_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS v2_discount_codes_admin_read ON public.v2_discount_codes;
CREATE POLICY v2_discount_codes_admin_read ON public.v2_discount_codes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- v2_discount_redemptions: owner-read + admin-read
GRANT SELECT ON public.v2_discount_redemptions TO authenticated;
GRANT ALL    ON public.v2_discount_redemptions TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.v2_discount_redemptions FROM authenticated, anon;
ALTER TABLE public.v2_discount_redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS v2_discount_redemptions_owner_read ON public.v2_discount_redemptions;
CREATE POLICY v2_discount_redemptions_owner_read ON public.v2_discount_redemptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS v2_discount_redemptions_admin_read ON public.v2_discount_redemptions;
CREATE POLICY v2_discount_redemptions_admin_read ON public.v2_discount_redemptions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- payment_events: reinforce raw payload confidentiality (admin already sole reader).
REVOKE SELECT (raw_payload) ON public.payment_events FROM authenticated, anon, PUBLIC;

-- Safe customer read RPC for their own payment events (no raw payloads).
CREATE OR REPLACE FUNCTION public.v2_my_payment_events(p_order_id uuid)
RETURNS TABLE (
  id uuid,
  order_id uuid,
  provider text,
  event_type public.v2_payment_event_type,
  amount_fils integer,
  currency text,
  received_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pe.id, pe.order_id, pe.provider, pe.event_type, pe.amount_fils, pe.currency, pe.received_at
  FROM public.payment_events pe
  JOIN public.orders o ON o.id = pe.order_id
  WHERE pe.order_id = p_order_id
    AND o.user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.v2_my_payment_events(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.v2_my_payment_events(uuid) TO authenticated;

-- Safe customer read RPC for their own payment attempts (no raw payloads).
CREATE OR REPLACE FUNCTION public.v2_my_payment_attempts(p_order_id uuid)
RETURNS TABLE (
  id uuid,
  order_id uuid,
  provider text,
  merchant_reference text,
  status text,
  checkout_url text,
  expected_amount_fils integer,
  currency text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pa.id, pa.order_id, pa.provider, pa.merchant_reference, pa.status,
         pa.checkout_url, pa.expected_amount_fils, pa.currency, pa.created_at, pa.updated_at
  FROM public.payment_attempts pa
  JOIN public.orders o ON o.id = pa.order_id
  WHERE pa.order_id = p_order_id
    AND o.user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.v2_my_payment_attempts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.v2_my_payment_attempts(uuid) TO authenticated;

-- =========================================================================
-- A7) Seed the single lifetime product (idempotent upsert)
-- =========================================================================
INSERT INTO public.products (sku, product_type, resource_id, title_en, title_ar,
                             price_fils, currency, is_active)
VALUES ('JOJO-FULL-LIBRARY-LIFETIME', 'lifetime'::public.v2_product_type, NULL,
        'JojoPrompts Full Library — Lifetime Access',
        'مكتبة جوجو الكاملة — وصول مدى الحياة',
        30000, 'KWD', true)
ON CONFLICT (sku) DO UPDATE SET
  product_type = EXCLUDED.product_type,
  resource_id  = NULL,
  title_en     = EXCLUDED.title_en,
  title_ar     = EXCLUDED.title_ar,
  price_fils   = 30000,
  currency     = 'KWD',
  is_active    = true,
  updated_at   = now();
