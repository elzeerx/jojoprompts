
-- =========================================================================
-- Phase A Hardening (additive). See also:
--   supabase/STORAGE_BUCKETS.md
--   supabase/bootstrap_storage.sql
-- The `resource-packages` private bucket is provisioned via the Supabase
-- storage tool (dashboard/API) because platform policy blocks direct writes
-- to storage.buckets from user migrations on this project. The bootstrap
-- SQL file is idempotent and can be applied where permitted.
-- =========================================================================

-- 1) TRUST BADGE ----------------------------------------------------------
-- The prior v2_resource_trust_badges view was SECURITY INVOKER and read
-- package_scans, which correctly denies anon/authenticated SELECT. Under
-- invoker privileges the view is unreadable. Replace it with a narrowly
-- scoped SECURITY DEFINER function that exposes only sanitized fields.

DROP VIEW IF EXISTS public.v2_resource_trust_badges;

CREATE OR REPLACE FUNCTION public.get_public_resource_trust_badges(
  resource_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  resource_id  uuid,
  version_id   uuid,
  scan_status  text,
  scanned_at   timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    r.id                     AS resource_id,
    rv.id                    AS version_id,
    ps.status::text          AS scan_status,
    ps.scanned_at            AS scanned_at
  FROM public.resources r
  JOIN public.resource_versions rv
    ON rv.id = r.current_version_id
   AND rv.resource_id = r.id
  LEFT JOIN LATERAL (
    SELECT s.status, s.scanned_at
    FROM public.package_scans s
    WHERE s.resource_version_id = rv.id
    ORDER BY s.scanned_at DESC NULLS LAST, s.created_at DESC
    LIMIT 1
  ) ps ON TRUE
  WHERE r.lifecycle = 'published'
    AND (resource_ids IS NULL OR r.id = ANY(resource_ids));
$$;

REVOKE ALL ON FUNCTION public.get_public_resource_trust_badges(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_resource_trust_badges(uuid[]) TO anon, authenticated;

COMMENT ON FUNCTION public.get_public_resource_trust_badges(uuid[]) IS
  'Public trust badge for published resources: exposes only sanitized scan status and timestamp for the current version. Never returns findings, scanner, or storage paths.';

-- 2) REVERSE-UPDATE INTEGRITY --------------------------------------------

-- 2a) Prevent moving a resource_version to a different resource while it is
--     still referenced as that resource's current_version_id.
CREATE OR REPLACE FUNCTION public.v2_prevent_current_version_reassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.resource_id IS DISTINCT FROM OLD.resource_id THEN
    IF EXISTS (
      SELECT 1 FROM public.resources r
      WHERE r.current_version_id = OLD.id
    ) THEN
      RAISE EXCEPTION
        'resource_versions.resource_id cannot be changed while this row is referenced as resources.current_version_id (version %)', OLD.id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS v2_resource_versions_prevent_move ON public.resource_versions;
CREATE TRIGGER v2_resource_versions_prevent_move
  BEFORE UPDATE OF resource_id ON public.resource_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.v2_prevent_current_version_reassignment();

-- 2b) Prevent changing products.product_type away from 'bundle' while
--     product_bundle_items still reference that product.
CREATE OR REPLACE FUNCTION public.v2_prevent_bundle_type_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.product_type = 'bundle'
     AND NEW.product_type IS DISTINCT FROM OLD.product_type THEN
    IF EXISTS (
      SELECT 1 FROM public.product_bundle_items pbi
      WHERE pbi.bundle_product_id = OLD.id
    ) THEN
      RAISE EXCEPTION
        'products.product_type cannot change from bundle while product_bundle_items still reference product %', OLD.id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS v2_products_prevent_bundle_type_change ON public.products;
CREATE TRIGGER v2_products_prevent_bundle_type_change
  BEFORE UPDATE OF product_type ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.v2_prevent_bundle_type_change();
