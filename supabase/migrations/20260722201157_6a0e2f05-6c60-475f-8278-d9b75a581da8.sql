
-- ============================================================
-- JojoPrompts V2.0 — Phase A CORRECTIVE MIGRATION
-- ============================================================

-- ---------- 1. ENTITLEMENT SCOPE ----------
DO $$ BEGIN
  CREATE TYPE public.v2_entitlement_scope AS ENUM ('resource','library');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.entitlements
  ADD COLUMN IF NOT EXISTS scope public.v2_entitlement_scope;

UPDATE public.entitlements SET scope =
  CASE
    WHEN grant_reason IN ('lifetime_purchase','lifetime_threshold') THEN 'library'::public.v2_entitlement_scope
    WHEN resource_id IS NULL THEN 'library'::public.v2_entitlement_scope
    ELSE 'resource'::public.v2_entitlement_scope
  END
WHERE scope IS NULL;

ALTER TABLE public.entitlements ALTER COLUMN scope SET NOT NULL;

ALTER TABLE public.entitlements
  DROP CONSTRAINT IF EXISTS lifetime_grants_have_no_resource,
  DROP CONSTRAINT IF EXISTS non_lifetime_grants_require_resource;

ALTER TABLE public.entitlements
  ADD CONSTRAINT entitlements_scope_resource_shape CHECK (
    (scope = 'resource' AND resource_id IS NOT NULL) OR
    (scope = 'library'  AND resource_id IS NULL)
  );

ALTER TABLE public.entitlements
  ADD CONSTRAINT entitlements_reason_scope_valid CHECK (
    CASE grant_reason
      WHEN 'purchase'            THEN scope = 'resource'
      WHEN 'free_acquisition'    THEN scope = 'resource'
      WHEN 'lifetime_purchase'   THEN scope = 'library'
      WHEN 'lifetime_threshold'  THEN scope = 'library'
      WHEN 'legacy_migration'    THEN scope IN ('resource','library')
      WHEN 'admin_grant'         THEN scope IN ('resource','library')
    END
  );

DROP INDEX IF EXISTS public.entitlements_user_resource_reason_key;
DROP INDEX IF EXISTS public.entitlements_user_lifetime_reason_key;

CREATE UNIQUE INDEX IF NOT EXISTS entitlements_one_active_per_user_resource
  ON public.entitlements(user_id, resource_id)
  WHERE scope = 'resource' AND revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS entitlements_one_active_library_per_user
  ON public.entitlements(user_id)
  WHERE scope = 'library' AND revoked_at IS NULL;

-- ---------- 2. DROP BROKEN updated_at TRIGGERS ----------
DROP TRIGGER IF EXISTS set_updated_at_product_bundle_items ON public.product_bundle_items;
DROP TRIGGER IF EXISTS set_updated_at_order_items ON public.order_items;

-- ---------- 3. TIGHTER BUNDLE VISIBILITY ----------
DROP POLICY IF EXISTS "bundle_items_public_read_when_bundle_visible" ON public.product_bundle_items;
CREATE POLICY "bundle_items_public_read_when_bundle_visible" ON public.product_bundle_items
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_bundle_items.bundle_product_id
        AND p.is_active
        AND p.product_type = 'bundle'
    )
    AND EXISTS (
      SELECT 1 FROM public.resources r
      WHERE r.id = product_bundle_items.resource_id
        AND r.lifecycle = 'published'
    )
  );

-- ---------- 4. PUBLIC PRE-PURCHASE DISCLOSURES ----------
ALTER TABLE public.resource_permissions
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.resource_permissions.is_public IS
  'Whether this declaration (permission/dependency/service/secret NAME) is visible on the public resource detail page. Secret VALUES must never be stored here — use a server-only table.';

GRANT SELECT ON public.resource_permissions TO anon;

DROP POLICY IF EXISTS "resource_permissions_public_read" ON public.resource_permissions;
CREATE POLICY "resource_permissions_public_read" ON public.resource_permissions
  FOR SELECT TO anon, authenticated
  USING (
    is_public = true
    AND EXISTS (
      SELECT 1 FROM public.resources r
      WHERE r.id = resource_permissions.resource_id
        AND r.lifecycle = 'published'
    )
  );

-- ---------- 5. PUBLIC TRUST BADGE VIEW ----------
DROP VIEW IF EXISTS public.v2_resource_trust_badges;
CREATE VIEW public.v2_resource_trust_badges
  WITH (security_invoker = true)
AS
SELECT
  r.id                              AS resource_id,
  r.current_version_id              AS version_id,
  latest.status                     AS scan_status,
  latest.scanned_at                 AS scanned_at
FROM public.resources r
LEFT JOIN LATERAL (
  SELECT ps.status, ps.scanned_at
  FROM public.package_scans ps
  WHERE ps.resource_version_id = r.current_version_id
  ORDER BY ps.scanned_at DESC NULLS LAST
  LIMIT 1
) latest ON true
WHERE r.lifecycle = 'published';

COMMENT ON VIEW public.v2_resource_trust_badges IS
  'Sanitized latest scan status per published resource. Never exposes scan findings or scanner internals.';

GRANT SELECT ON public.v2_resource_trust_badges TO anon, authenticated;

-- ---------- 6. DATA INTEGRITY ----------

-- 6a. resources.current_version_id must belong to the same resource
CREATE OR REPLACE FUNCTION public.v2_check_current_version_matches_resource()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_resource_id uuid;
BEGIN
  IF NEW.current_version_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT resource_id INTO v_resource_id
    FROM public.resource_versions
   WHERE id = NEW.current_version_id;
  IF v_resource_id IS NULL OR v_resource_id <> NEW.id THEN
    RAISE EXCEPTION 'resources.current_version_id (%) does not belong to resource %', NEW.current_version_id, NEW.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.v2_check_current_version_matches_resource() FROM PUBLIC;

DROP TRIGGER IF EXISTS v2_resources_current_version_match ON public.resources;
CREATE CONSTRAINT TRIGGER v2_resources_current_version_match
  AFTER INSERT OR UPDATE OF current_version_id ON public.resources
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.v2_check_current_version_matches_resource();

-- 6b. At most one ACTIVE lifetime product
CREATE UNIQUE INDEX IF NOT EXISTS products_one_active_lifetime
  ON public.products((product_type))
  WHERE product_type = 'lifetime' AND is_active = true;

-- 6c. product_bundle_items.bundle_product_id must be a product of type 'bundle'
CREATE OR REPLACE FUNCTION public.v2_check_bundle_item_parent_is_bundle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_type public.v2_product_type;
BEGIN
  SELECT product_type INTO v_type FROM public.products WHERE id = NEW.bundle_product_id;
  IF v_type IS DISTINCT FROM 'bundle' THEN
    RAISE EXCEPTION 'product_bundle_items.bundle_product_id (%) must reference a product with product_type=bundle (got %)',
      NEW.bundle_product_id, v_type
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.v2_check_bundle_item_parent_is_bundle() FROM PUBLIC;

DROP TRIGGER IF EXISTS v2_bundle_items_parent_type ON public.product_bundle_items;
CREATE CONSTRAINT TRIGGER v2_bundle_items_parent_type
  AFTER INSERT OR UPDATE OF bundle_product_id ON public.product_bundle_items
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.v2_check_bundle_item_parent_is_bundle();
