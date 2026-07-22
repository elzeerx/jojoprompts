-- ============================================================
-- JojoPrompts V2.0 — Phase A: Database Foundation
-- Additive, non-destructive. Preserves ALL legacy data.
-- Money: integer fils (1 KWD = 1000 fils).
-- LIFETIME_THRESHOLD_FILS = 30000 (== 30.000 KWD).
-- All new objects are RLS-enabled; no permissive fallbacks.
-- ============================================================

-- ---------- 0. ENUMS ----------
DO $$ BEGIN
  CREATE TYPE public.v2_resource_type AS ENUM
    ('skill','automation','prompt','prompt_pack','image_style','bundle');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.v2_resource_lifecycle AS ENUM
    ('draft','review','published','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.v2_product_type AS ENUM
    ('free','individual','bundle','lifetime');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.v2_grant_reason AS ENUM
    ('purchase','free_acquisition','lifetime_purchase','lifetime_threshold','legacy_migration','admin_grant');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.v2_order_status AS ENUM
    ('pending','paid','failed','refunded','partially_refunded','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.v2_payment_event_type AS ENUM
    ('created','authorized','captured','failed','refunded','chargeback','reversal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.v2_refund_status AS ENUM
    ('pending','approved','denied','processed','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.v2_scan_status AS ENUM
    ('pending','clean','suspicious','malicious','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.v2_report_status AS ENUM
    ('open','reviewing','resolved','dismissed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TYPE public.v2_product_type IS
  'V2 product types. The "lifetime" product is Full Library Lifetime; price and progress threshold are fixed at 30000 fils (30.000 KWD).';

-- ---------- 1. CORE CATALOG ----------

-- resources: unified Jojo-owned catalog row
CREATE TABLE IF NOT EXISTS public.resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  type public.v2_resource_type NOT NULL,
  lifecycle public.v2_resource_lifecycle NOT NULL DEFAULT 'draft',
  title_en text NOT NULL,
  title_ar text,
  summary_en text,
  summary_ar text,
  description_en text,
  description_ar text,
  hero_image_path text,
  category text,
  tags text[] NOT NULL DEFAULT '{}',
  effort_minutes integer CHECK (effort_minutes IS NULL OR effort_minutes >= 0),
  owner_id uuid, -- future-proof; V2 writes admin-only. No FK to auth.users per project convention.
  current_version_id uuid, -- FK added after resource_versions is created
  legacy_prompt_id uuid UNIQUE REFERENCES public.prompts(id) ON DELETE SET NULL,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN public.resources.legacy_prompt_id IS
  'Non-destructive backfill link to legacy public.prompts.id. UNIQUE prevents duplicate migration. NULL for net-new V2 resources. ON DELETE SET NULL so legacy prompt deletion never cascades into V2.';
COMMENT ON COLUMN public.resources.owner_id IS
  'Reserved for future creator model. V2 writes are admin-only via RLS regardless of this column.';

CREATE INDEX IF NOT EXISTS resources_lifecycle_idx ON public.resources(lifecycle);
CREATE INDEX IF NOT EXISTS resources_type_lifecycle_idx ON public.resources(type, lifecycle);
CREATE INDEX IF NOT EXISTS resources_published_at_idx ON public.resources(published_at DESC) WHERE lifecycle = 'published';
CREATE INDEX IF NOT EXISTS resources_tags_gin_idx ON public.resources USING GIN(tags);

GRANT SELECT ON public.resources TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.resources TO authenticated; -- gated by RLS (admin-only)
GRANT ALL ON public.resources TO service_role;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resources_public_read_published" ON public.resources
  FOR SELECT TO anon, authenticated
  USING (lifecycle = 'published');
CREATE POLICY "resources_admin_read_all" ON public.resources
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "resources_admin_insert" ON public.resources
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "resources_admin_update" ON public.resources
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "resources_admin_delete" ON public.resources
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- resource_versions
CREATE TABLE IF NOT EXISTS public.resource_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  version text NOT NULL, -- semver-like, e.g. "1.2.0"
  changelog_en text,
  changelog_ar text,
  package_size_bytes bigint CHECK (package_size_bytes IS NULL OR package_size_bytes >= 0),
  package_checksum text,
  is_current boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_id, version)
);
CREATE INDEX IF NOT EXISTS resource_versions_resource_idx ON public.resource_versions(resource_id);
CREATE UNIQUE INDEX IF NOT EXISTS resource_versions_one_current_per_resource
  ON public.resource_versions(resource_id) WHERE is_current = true;

ALTER TABLE public.resources
  ADD CONSTRAINT resources_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES public.resource_versions(id) ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

GRANT SELECT ON public.resource_versions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.resource_versions TO authenticated;
GRANT ALL ON public.resource_versions TO service_role;
ALTER TABLE public.resource_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resource_versions_public_read_when_parent_published" ON public.resource_versions
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.resources r
                 WHERE r.id = resource_versions.resource_id AND r.lifecycle = 'published'));
CREATE POLICY "resource_versions_admin_all" ON public.resource_versions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- resource_files (PRIVATE storage paths — never exposed to public)
CREATE TABLE IF NOT EXISTS public.resource_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_version_id uuid NOT NULL REFERENCES public.resource_versions(id) ON DELETE CASCADE,
  storage_bucket text NOT NULL DEFAULT 'resource-packages',
  storage_path text NOT NULL,
  file_name text NOT NULL,
  content_type text,
  size_bytes bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  checksum_sha256 text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (storage_bucket, storage_path)
);
CREATE INDEX IF NOT EXISTS resource_files_version_idx ON public.resource_files(resource_version_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_files TO authenticated;
GRANT ALL ON public.resource_files TO service_role;
-- NO grant to anon. Storage paths are private.
ALTER TABLE public.resource_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resource_files_admin_all" ON public.resource_files
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
-- Entitled users read via Phase B server function (SECURITY DEFINER), never directly.

-- platform_compatibility
CREATE TABLE IF NOT EXISTS public.platform_compatibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  platform_slug text NOT NULL,          -- e.g. 'chatgpt','claude','midjourney','n8n'
  min_version text,
  notes_en text,
  notes_ar text,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_id, platform_slug)
);
CREATE INDEX IF NOT EXISTS platform_compat_platform_idx ON public.platform_compatibility(platform_slug);

GRANT SELECT ON public.platform_compatibility TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.platform_compatibility TO authenticated;
GRANT ALL ON public.platform_compatibility TO service_role;
ALTER TABLE public.platform_compatibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_compat_public_read_when_parent_published" ON public.platform_compatibility
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.resources r
                 WHERE r.id = platform_compatibility.resource_id AND r.lifecycle = 'published'));
CREATE POLICY "platform_compat_admin_all" ON public.platform_compatibility
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- installation_guides
CREATE TABLE IF NOT EXISTS public.installation_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  platform_slug text NOT NULL,
  steps_en jsonb NOT NULL DEFAULT '[]'::jsonb,
  steps_ar jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimated_minutes integer CHECK (estimated_minutes IS NULL OR estimated_minutes >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_id, platform_slug)
);

GRANT SELECT ON public.installation_guides TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.installation_guides TO authenticated;
GRANT ALL ON public.installation_guides TO service_role;
ALTER TABLE public.installation_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "install_guides_public_read_when_parent_published" ON public.installation_guides
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.resources r
                 WHERE r.id = installation_guides.resource_id AND r.lifecycle = 'published'));
CREATE POLICY "install_guides_admin_all" ON public.installation_guides
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- resource_permissions (SENSITIVE: scopes, required secrets, dependencies)
CREATE TABLE IF NOT EXISTS public.resource_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  kind text NOT NULL, -- 'permission' | 'dependency' | 'secret' | 'service'
  key text NOT NULL,  -- e.g. 'openai.api_key'
  label_en text,
  label_ar text,
  is_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_id, kind, key)
);

-- No anon grant. Only entitled owners/admins should see; entitled owners will read via server function later.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_permissions TO authenticated;
GRANT ALL ON public.resource_permissions TO service_role;
ALTER TABLE public.resource_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resource_permissions_admin_all" ON public.resource_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- licenses
CREATE TABLE IF NOT EXISTS public.licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE UNIQUE,
  license_key text NOT NULL, -- e.g. 'jojo-standard-v1'
  terms_en text,
  terms_ar text,
  allows_commercial boolean NOT NULL DEFAULT true,
  allows_redistribution boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.licenses TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.licenses TO authenticated;
GRANT ALL ON public.licenses TO service_role;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "licenses_public_read_when_parent_published" ON public.licenses
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.resources r
                 WHERE r.id = licenses.resource_id AND r.lifecycle = 'published'));
CREATE POLICY "licenses_admin_all" ON public.licenses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- package_scans (SENSITIVE)
CREATE TABLE IF NOT EXISTS public.package_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_version_id uuid NOT NULL REFERENCES public.resource_versions(id) ON DELETE CASCADE,
  scanner text NOT NULL,
  status public.v2_scan_status NOT NULL DEFAULT 'pending',
  findings jsonb NOT NULL DEFAULT '{}'::jsonb,
  scanned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS package_scans_version_idx ON public.package_scans(resource_version_id);

-- Server-only writes. Only admins can even read (findings may include exploit detail).
GRANT SELECT ON public.package_scans TO authenticated;
GRANT ALL ON public.package_scans TO service_role;
ALTER TABLE public.package_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "package_scans_admin_read" ON public.package_scans
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
-- No INSERT/UPDATE/DELETE policies for any client role → only service_role can write.

-- ---------- 2. COMMERCE ----------

-- products
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  product_type public.v2_product_type NOT NULL,
  resource_id uuid REFERENCES public.resources(id) ON DELETE RESTRICT, -- NULL for lifetime/bundle-only
  title_en text NOT NULL,
  title_ar text,
  price_fils integer NOT NULL DEFAULT 0 CHECK (price_fils >= 0),
  currency text NOT NULL DEFAULT 'KWD' CHECK (currency = 'KWD'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- The lifetime product must always be priced at exactly 30000 fils.
  CONSTRAINT lifetime_price_fixed CHECK (
    product_type <> 'lifetime' OR price_fils = 30000
  ),
  -- Free products must be 0 fils.
  CONSTRAINT free_price_zero CHECK (
    product_type <> 'free' OR price_fils = 0
  ),
  -- Individual products must reference a resource.
  CONSTRAINT individual_requires_resource CHECK (
    product_type <> 'individual' OR resource_id IS NOT NULL
  )
);
COMMENT ON CONSTRAINT lifetime_price_fixed ON public.products IS
  'Enforces Full Library Lifetime = 30000 fils (30.000 KWD). Change requires an explicit migration.';
CREATE INDEX IF NOT EXISTS products_resource_idx ON public.products(resource_id);
CREATE INDEX IF NOT EXISTS products_type_active_idx ON public.products(product_type, is_active);

GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_public_read_active_published" ON public.products
  FOR SELECT TO anon, authenticated
  USING (
    is_active
    AND (
      resource_id IS NULL -- lifetime / bundle-only products remain visible
      OR EXISTS (SELECT 1 FROM public.resources r
                 WHERE r.id = products.resource_id AND r.lifecycle = 'published')
    )
  );
CREATE POLICY "products_admin_read_all" ON public.products
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "products_admin_write" ON public.products
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- product_bundle_items
CREATE TABLE IF NOT EXISTS public.product_bundle_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bundle_product_id, resource_id)
);

GRANT SELECT ON public.product_bundle_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_bundle_items TO authenticated;
GRANT ALL ON public.product_bundle_items TO service_role;
ALTER TABLE public.product_bundle_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bundle_items_public_read_when_bundle_visible" ON public.product_bundle_items
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_bundle_items.bundle_product_id AND p.is_active
  ));
CREATE POLICY "bundle_items_admin_all" ON public.product_bundle_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- carts (one active cart per user is enforced via partial unique index)
CREATE TABLE IF NOT EXISTS public.carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','ordered','abandoned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS carts_one_active_per_user
  ON public.carts(user_id) WHERE status = 'active';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.carts TO authenticated;
GRANT ALL ON public.carts TO service_role;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "carts_owner_all" ON public.carts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "carts_admin_read" ON public.carts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- cart_items
CREATE TABLE IF NOT EXISTS public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_fils integer NOT NULL CHECK (unit_price_fils >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_id, product_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT ALL ON public.cart_items TO service_role;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cart_items_owner_all" ON public.cart_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_items.cart_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_items.cart_id AND c.user_id = auth.uid()));
CREATE POLICY "cart_items_admin_read" ON public.cart_items
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- orders
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_number text NOT NULL UNIQUE,
  status public.v2_order_status NOT NULL DEFAULT 'pending',
  subtotal_fils integer NOT NULL DEFAULT 0 CHECK (subtotal_fils >= 0),
  discount_fils integer NOT NULL DEFAULT 0 CHECK (discount_fils >= 0),
  total_fils integer NOT NULL DEFAULT 0 CHECK (total_fils >= 0),
  currency text NOT NULL DEFAULT 'KWD' CHECK (currency = 'KWD'),
  paid_fils integer NOT NULL DEFAULT 0 CHECK (paid_fils >= 0), -- actual amount settled, used for lifetime credit
  discount_code text,
  provider text, -- 'paypal' | 'stripe' | 'upayment' | 'free' etc.
  provider_reference text,
  idempotency_key text UNIQUE, -- caller-supplied; prevents duplicate checkout
  placed_at timestamptz,
  settled_at timestamptz,
  legacy_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN public.orders.paid_fils IS
  'Actual settled amount (post-discount, pre-refund) in fils. Feeds lifetime credit ledger. Effective lifetime progress is capped at 30000 fils.';
COMMENT ON COLUMN public.orders.legacy_transaction_id IS
  'Non-destructive link to legacy public.transactions.id when an order was migrated from a legacy PayPal transaction.';

CREATE INDEX IF NOT EXISTS orders_user_idx ON public.orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON public.orders(status);

GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
-- No client INSERT/UPDATE/DELETE: orders are created by server functions only.
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_owner_read" ON public.orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "orders_admin_read" ON public.orders
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- order_items
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  resource_id uuid REFERENCES public.resources(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_fils integer NOT NULL CHECK (unit_price_fils >= 0),
  line_total_fils integer NOT NULL CHECK (line_total_fils >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON public.order_items(order_id);

GRANT SELECT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_items_owner_read" ON public.order_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid()));
CREATE POLICY "order_items_admin_read" ON public.order_items
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- payment_events (server-only; idempotency on provider+external id)
CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  provider text NOT NULL,
  external_event_id text NOT NULL,
  event_type public.v2_payment_event_type NOT NULL,
  amount_fils integer CHECK (amount_fils IS NULL OR amount_fils >= 0),
  currency text NOT NULL DEFAULT 'KWD' CHECK (currency = 'KWD'),
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_event_id)
);
CREATE INDEX IF NOT EXISTS payment_events_order_idx ON public.payment_events(order_id);

GRANT ALL ON public.payment_events TO service_role;
-- NO grants to authenticated/anon. Not client-readable or writable.
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_events_admin_read" ON public.payment_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
-- No write policies for any client role.

-- refunds
CREATE TABLE IF NOT EXISTS public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL,
  amount_fils integer NOT NULL CHECK (amount_fils > 0),
  reason text,
  status public.v2_refund_status NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  provider_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS refunds_order_idx ON public.refunds(order_id);
CREATE INDEX IF NOT EXISTS refunds_user_idx ON public.refunds(user_id);

GRANT SELECT ON public.refunds TO authenticated;
GRANT ALL ON public.refunds TO service_role;
-- Users request refunds via server function, not direct INSERT.
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "refunds_owner_read" ON public.refunds
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "refunds_admin_read" ON public.refunds
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- entitlements
CREATE TABLE IF NOT EXISTS public.entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  resource_id uuid REFERENCES public.resources(id) ON DELETE RESTRICT, -- NULL for lifetime grants
  grant_reason public.v2_grant_reason NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz, -- nullable; permanent by default, allowed for legacy_migration bounded windows
  revoked_at timestamptz,
  revoke_reason text,
  legacy_source text, -- e.g. 'subscription:<plan_slug>' when migrated
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lifetime_grants_have_no_resource CHECK (
    grant_reason NOT IN ('lifetime_purchase','lifetime_threshold') OR resource_id IS NULL
  ),
  CONSTRAINT non_lifetime_grants_require_resource CHECK (
    grant_reason IN ('lifetime_purchase','lifetime_threshold') OR resource_id IS NOT NULL
  )
);
CREATE INDEX IF NOT EXISTS entitlements_user_idx ON public.entitlements(user_id);
CREATE INDEX IF NOT EXISTS entitlements_user_resource_idx ON public.entitlements(user_id, resource_id) WHERE revoked_at IS NULL;

-- Partial unique indexes:
-- 1. Per-resource entitlements: one per (user, resource, reason) — supports free_acquisition idempotency and prevents duplicate purchase grants
CREATE UNIQUE INDEX IF NOT EXISTS entitlements_user_resource_reason_key
  ON public.entitlements(user_id, resource_id, grant_reason)
  WHERE resource_id IS NOT NULL AND revoked_at IS NULL;
-- 2. Lifetime entitlements: one per (user, reason) when resource_id is NULL
CREATE UNIQUE INDEX IF NOT EXISTS entitlements_user_lifetime_reason_key
  ON public.entitlements(user_id, grant_reason)
  WHERE resource_id IS NULL AND revoked_at IS NULL;

GRANT SELECT ON public.entitlements TO authenticated;
GRANT ALL ON public.entitlements TO service_role;
-- No client writes. Server functions grant/revoke.
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entitlements_owner_read" ON public.entitlements
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "entitlements_admin_read" ON public.entitlements
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- lifetime_credit_entries (ledger)
CREATE TABLE IF NOT EXISTS public.lifetime_credit_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  refund_id uuid REFERENCES public.refunds(id) ON DELETE SET NULL,
  amount_fils integer NOT NULL, -- positive for credit, negative for reversal
  reason text NOT NULL,         -- 'settled_purchase' | 'refund_reversal' | 'admin_adjustment'
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_source_per_entry CHECK (
    (order_id IS NOT NULL)::int + (refund_id IS NOT NULL)::int <= 1
  ),
  UNIQUE (order_id, reason),
  UNIQUE (refund_id, reason)
);
COMMENT ON TABLE public.lifetime_credit_entries IS
  'Append-only ledger of settled non-refunded Jojo-owned purchase contributions toward Full Library Lifetime (30000 fils). Effective progress = LEAST(SUM(amount_fils), 30000).';
CREATE INDEX IF NOT EXISTS lifetime_credit_user_idx ON public.lifetime_credit_entries(user_id);

GRANT SELECT ON public.lifetime_credit_entries TO authenticated;
GRANT ALL ON public.lifetime_credit_entries TO service_role;
ALTER TABLE public.lifetime_credit_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lifetime_credit_owner_read" ON public.lifetime_credit_entries
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "lifetime_credit_admin_read" ON public.lifetime_credit_entries
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- ---------- 3. TRUST & ACTIVITY ----------

-- reports (user-submitted)
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid NOT NULL,
  resource_id uuid REFERENCES public.resources(id) ON DELETE SET NULL,
  category text NOT NULL,
  details text,
  status public.v2_report_status NOT NULL DEFAULT 'open',
  resolved_at timestamptz,
  resolver_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reports_status_idx ON public.reports(status);
CREATE INDEX IF NOT EXISTS reports_resource_idx ON public.reports(resource_id);

GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_reporter_insert" ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_user_id = auth.uid());
CREATE POLICY "reports_reporter_read_own" ON public.reports
  FOR SELECT TO authenticated
  USING (reporter_user_id = auth.uid());
CREATE POLICY "reports_admin_all" ON public.reports
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- activity_events (server-only audit trail)
CREATE TABLE IF NOT EXISTS public.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  actor_type text NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user','admin','system')),
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activity_events_actor_idx ON public.activity_events(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_events_entity_idx ON public.activity_events(entity_type, entity_id);

GRANT ALL ON public.activity_events TO service_role;
-- No client write access. Admin read only.
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_events_admin_read" ON public.activity_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- ---------- 4. UPDATED_AT TRIGGERS ----------
-- Reuse existing helper public.set_updated_at_timestamp() (already SECURITY DEFINER-safe? It's SET search_path=public, no SECURITY DEFINER needed for a simple trigger.)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'resources','resource_versions','resource_files','platform_compatibility',
    'installation_guides','resource_permissions','licenses','package_scans',
    'products','product_bundle_items','carts','cart_items','orders','order_items',
    'refunds','entitlements','reports'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON public.%I;
       CREATE TRIGGER %I BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();',
      'set_updated_at_' || t, t, 'set_updated_at_' || t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- End of Phase A migration
-- ============================================================