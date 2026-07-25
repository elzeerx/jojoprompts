-- Phase 6E4 corrective hardening: close server-side submit-for-review bypass.
--
-- Prior state: admin_transition_resource_lifecycle(p_action='review') accepted
-- any draft resource with no validation, allowing a fail-open bypass around the
-- readiness checks enforced by admin_publish_resource.
--
-- This migration introduces a shared readiness validator and reuses it for the
-- 'review' action so that the review transition enforces the same rules as
-- publish. Publish (admin_publish_resource) remains authoritative; the
-- validator here is a strict mirror of its readiness checks (see the SQL
-- comments below) and is intentionally colocated so a future single-writer
-- refactor is straightforward.

CREATE SCHEMA IF NOT EXISTS private;

-- Shared publish-readiness validator. Returns an array of error codes; empty
-- array means "ready". MUST stay in sync with admin_publish_resource() in
-- migration 20260722215158_...sql. Any drift is a security regression and is
-- covered by the assertion block at the bottom of this file.
CREATE OR REPLACE FUNCTION private._v2_resource_publish_errors(p_resource_id uuid)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_r RECORD;
  v_errs text[] := ARRAY[]::text[];
  v_active_products int;
  v_positive_bundle_products int;
  v_has_bad_lifetime boolean;
  v_scan_status text;
BEGIN
  SELECT * INTO v_r FROM public.resources WHERE id = p_resource_id;
  IF NOT FOUND THEN
    RETURN ARRAY['resource_not_found']::text[];
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
  END IF;

  RETURN v_errs;
END;
$fn$;

REVOKE ALL ON FUNCTION private._v2_resource_publish_errors(uuid) FROM PUBLIC, anon, authenticated;

-- Hardened admin_transition_resource_lifecycle: enforces publish-readiness for
-- 'review' transitions so submit-for-review no longer bypasses validation.
-- archive/restore behavior is preserved.
CREATE OR REPLACE FUNCTION public.admin_transition_resource_lifecycle(
  p_resource_id uuid, p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_admin boolean;
  v_new_lifecycle text;
  v_updated int;
  v_errs text[];
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

  -- Validate readiness for 'review' transitions using the shared validator.
  -- Mirrors admin_publish_resource() checks; scan_status must be 'clean'.
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
    v_actor, 'admin', 'resource', p_resource_id, 'lifecycle_' || p_action, '{}'::jsonb
  );

  RETURN jsonb_build_object('ok', true);
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_transition_resource_lifecycle(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_transition_resource_lifecycle(uuid, text) TO authenticated, service_role;

-- Assertion: validator remains admin-only, transition is authenticated-only.
DO $$
DECLARE
  v_anon_transition boolean;
  v_auth_transition boolean;
  v_anon_validator  boolean;
BEGIN
  SELECT has_function_privilege('anon',           'public.admin_transition_resource_lifecycle(uuid, text)', 'EXECUTE') INTO v_anon_transition;
  SELECT has_function_privilege('authenticated',  'public.admin_transition_resource_lifecycle(uuid, text)', 'EXECUTE') INTO v_auth_transition;
  SELECT has_function_privilege('anon',           'private._v2_resource_publish_errors(uuid)',              'EXECUTE') INTO v_anon_validator;
  IF v_anon_transition THEN RAISE EXCEPTION 'anon must not execute admin_transition_resource_lifecycle'; END IF;
  IF NOT v_auth_transition THEN RAISE EXCEPTION 'authenticated must execute admin_transition_resource_lifecycle'; END IF;
  IF v_anon_validator THEN RAISE EXCEPTION 'anon must not execute private._v2_resource_publish_errors'; END IF;
END $$;