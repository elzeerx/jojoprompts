-- JojoPrompts V2 protected-content and published-version boundary.
--
-- Goals:
--   1. Keep paid textual content outside the exposed public schema.
--   2. Version that content so a new draft never overwrites a purchased version.
--   3. Keep public cards, trust badges, content reads, and downloads pinned to an
--      explicitly published version while admins work on the next version.
--   4. Route AI Studio into the unified V2 publisher instead of legacy prompts.

-- ---------------------------------------------------------------------------
-- 1) Published-version pointer and AI Studio lineage
-- ---------------------------------------------------------------------------

ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS latest_published_version_id uuid;

ALTER TABLE public.ai_studio_drafts
  ADD COLUMN IF NOT EXISTS published_resource_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'resources_latest_published_version_id_fkey'
       AND conrelid = 'public.resources'::regclass
  ) THEN
    ALTER TABLE public.resources
      ADD CONSTRAINT resources_latest_published_version_id_fkey
      FOREIGN KEY (latest_published_version_id)
      REFERENCES public.resource_versions(id)
      ON DELETE SET NULL
      DEFERRABLE INITIALLY DEFERRED;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'ai_studio_drafts_published_resource_id_fkey'
       AND conrelid = 'public.ai_studio_drafts'::regclass
  ) THEN
    ALTER TABLE public.ai_studio_drafts
      ADD CONSTRAINT ai_studio_drafts_published_resource_id_fkey
      FOREIGN KEY (published_resource_id)
      REFERENCES public.resources(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS resources_latest_published_version_idx
  ON public.resources (latest_published_version_id)
  WHERE latest_published_version_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_studio_drafts_published_resource_idx
  ON public.ai_studio_drafts (published_resource_id)
  WHERE published_resource_id IS NOT NULL;

-- Backfill from the newest actually-published version, not merely the mutable
-- current working pointer.
UPDATE public.resources r
   SET latest_published_version_id = (
         SELECT rv.id
           FROM public.resource_versions rv
          WHERE rv.resource_id = r.id
            AND rv.published_at IS NOT NULL
          ORDER BY rv.published_at DESC, rv.created_at DESC, rv.id DESC
          LIMIT 1
       )
 WHERE r.lifecycle IN (
         'published'::public.v2_resource_lifecycle,
         'archived'::public.v2_resource_lifecycle
       )
   AND r.latest_published_version_id IS NULL;

CREATE OR REPLACE FUNCTION private._v2_validate_latest_published_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (
    NEW.lifecycle = 'published'::public.v2_resource_lifecycle
    OR (
      NEW.lifecycle = 'archived'::public.v2_resource_lifecycle
      AND NEW.published_at IS NOT NULL
    )
  )
     AND NEW.latest_published_version_id IS NULL THEN
    RAISE EXCEPTION 'latest_published_version_required'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.latest_published_version_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.resource_versions rv
     WHERE rv.id = NEW.latest_published_version_id
       AND rv.resource_id = NEW.id
       AND rv.published_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'latest_published_version_invalid'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION private._v2_validate_latest_published_version()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS resources_latest_published_version_valid
  ON public.resources;
CREATE CONSTRAINT TRIGGER resources_latest_published_version_valid
  AFTER INSERT OR UPDATE OF
    latest_published_version_id, lifecycle, published_at
  ON public.resources
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION private._v2_validate_latest_published_version();

-- Once a version is the customer-facing pointer it cannot be deleted,
-- reassigned to another resource, or made unpublished behind the resource
-- trigger's back. Publishing a new draft remains valid because it is not
-- referenced until admin_publish_resource advances the pointer.
CREATE OR REPLACE FUNCTION private._v2_protect_referenced_published_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_version_id uuid := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.id
    ELSE NEW.id
  END;
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.resources r
     WHERE r.latest_published_version_id = v_version_id
       AND (
         TG_OP = 'DELETE'
         OR NEW.published_at IS NULL
         OR NEW.resource_id <> r.id
       )
  ) THEN
    RAISE EXCEPTION 'referenced_published_version_immutable'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$$;

REVOKE ALL
  ON FUNCTION private._v2_protect_referenced_published_version()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS resource_versions_published_reference_immutable
  ON public.resource_versions;
CREATE TRIGGER resource_versions_published_reference_immutable
  BEFORE UPDATE OF resource_id, published_at
  ON public.resource_versions
  FOR EACH ROW
  EXECUTE FUNCTION private._v2_protect_referenced_published_version();

DROP TRIGGER IF EXISTS resource_versions_published_reference_delete
  ON public.resource_versions;
CREATE TRIGGER resource_versions_published_reference_delete
  BEFORE DELETE
  ON public.resource_versions
  FOR EACH ROW
  EXECUTE FUNCTION private._v2_protect_referenced_published_version();

-- ---------------------------------------------------------------------------
-- 2) Private, version-scoped protected text
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS private.resource_version_contents (
  resource_version_id uuid PRIMARY KEY
    REFERENCES public.resource_versions(id) ON DELETE CASCADE,
  content_en text,
  content_ar text,
  content_format text NOT NULL DEFAULT 'text',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resource_version_contents_has_content
    CHECK (
      length(btrim(coalesce(content_en, ''))) > 0
      OR length(btrim(coalesce(content_ar, ''))) > 0
    ),
  CONSTRAINT resource_version_contents_format_valid
    CHECK (content_format IN ('text', 'markdown', 'json', 'yaml')),
  CONSTRAINT resource_version_contents_size_bounded
    CHECK (
      octet_length(coalesce(content_en, '')) <= 1048576
      AND octet_length(coalesce(content_ar, '')) <= 1048576
    )
);

ALTER TABLE private.resource_version_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.resource_version_contents FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.resource_version_contents
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE private.resource_version_contents TO service_role;

-- Freeze the legacy prompt body into its published V2 version. This preserves
-- the original content even if the legacy table is later retired.
INSERT INTO private.resource_version_contents (
  resource_version_id,
  content_en,
  content_ar,
  content_format,
  created_by,
  updated_by
)
SELECT
  r.latest_published_version_id,
  p.prompt_text,
  p.prompt_text_ar,
  'text',
  r.owner_id,
  r.owner_id
FROM public.resources r
JOIN public.prompts p ON p.id = r.legacy_prompt_id
WHERE r.latest_published_version_id IS NOT NULL
  AND (
    length(btrim(coalesce(p.prompt_text, ''))) > 0
    OR length(btrim(coalesce(p.prompt_text_ar, ''))) > 0
  )
ON CONFLICT (resource_version_id) DO NOTHING;

CREATE OR REPLACE FUNCTION private._v2_protect_published_content()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_version_id uuid;
  v_published_at timestamptz;
BEGIN
  v_version_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.resource_version_id
    ELSE NEW.resource_version_id
  END;

  SELECT rv.published_at
    INTO v_published_at
    FROM public.resource_versions rv
   WHERE rv.id = v_version_id;

  IF v_published_at IS NOT NULL THEN
    RAISE EXCEPTION 'published_version_immutable' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION private._v2_protect_published_content()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS resource_version_contents_published_immutable
  ON private.resource_version_contents;
CREATE TRIGGER resource_version_contents_published_immutable
  BEFORE INSERT OR UPDATE OR DELETE
  ON private.resource_version_contents
  FOR EACH ROW
  EXECUTE FUNCTION private._v2_protect_published_content();

-- ---------------------------------------------------------------------------
-- 3) Transactional V2 publisher wrapper and admin read RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.save_admin_resource_draft_v2(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_result jsonb;
  v_resource_id uuid;
  v_version_id uuid;
  v_resource_type text;
  v_content jsonb := payload -> 'private_content';
  v_content_en text;
  v_content_ar text;
  v_content_format text;
  v_source_draft_id uuid;
  v_updated int;
BEGIN
  IF v_actor IS NULL
     OR NOT public.has_role(v_actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  -- Existing publisher owns all public metadata/version/product integrity.
  -- Removing the V2-only keys keeps the legacy signature forward compatible.
  v_result := public.save_admin_resource_draft(
    payload - 'private_content' - 'source_ai_studio_draft_id'
  );

  IF coalesce((v_result ->> 'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'resource_save_failed';
  END IF;

  v_resource_id := nullif(v_result ->> 'resource_id', '')::uuid;
  v_version_id := nullif(v_result ->> 'current_version_id', '')::uuid;

  SELECT r.type::text
    INTO v_resource_type
    FROM public.resources r
   WHERE r.id = v_resource_id;

  IF payload ? 'private_content' THEN
    IF v_version_id IS NULL THEN
      RAISE EXCEPTION 'private_content_requires_version'
        USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
      SELECT 1
        FROM public.resource_versions rv
       WHERE rv.id = v_version_id
         AND rv.published_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'published_version_immutable'
        USING ERRCODE = '42501';
    END IF;

    v_content_en := nullif(v_content ->> 'content_en', '');
    v_content_ar := nullif(v_content ->> 'content_ar', '');
    v_content_format := coalesce(nullif(v_content ->> 'content_format', ''), 'text');

    IF v_content_format NOT IN ('text', 'markdown', 'json', 'yaml') THEN
      RAISE EXCEPTION 'private_content_format_invalid'
        USING ERRCODE = '23514';
    END IF;

    IF v_resource_type = 'bundle'
       AND (
         length(btrim(coalesce(v_content_en, ''))) > 0
         OR length(btrim(coalesce(v_content_ar, ''))) > 0
       ) THEN
      RAISE EXCEPTION 'bundle_private_content_forbidden'
        USING ERRCODE = '23514';
    END IF;

    IF length(btrim(coalesce(v_content_en, ''))) = 0
       AND length(btrim(coalesce(v_content_ar, ''))) = 0 THEN
      DELETE FROM private.resource_version_contents
       WHERE resource_version_id = v_version_id;
    ELSE
      INSERT INTO private.resource_version_contents (
        resource_version_id,
        content_en,
        content_ar,
        content_format,
        created_by,
        updated_by
      ) VALUES (
        v_version_id,
        v_content_en,
        v_content_ar,
        v_content_format,
        v_actor,
        v_actor
      )
      ON CONFLICT (resource_version_id) DO UPDATE SET
        content_en = EXCLUDED.content_en,
        content_ar = EXCLUDED.content_ar,
        content_format = EXCLUDED.content_format,
        updated_by = v_actor,
        updated_at = now();
    END IF;
  END IF;

  IF nullif(payload ->> 'source_ai_studio_draft_id', '') IS NOT NULL THEN
    v_source_draft_id :=
      (payload ->> 'source_ai_studio_draft_id')::uuid;

    UPDATE public.ai_studio_drafts
       SET status = 'imported',
           published_resource_id = v_resource_id,
           updated_at = now()
     WHERE id = v_source_draft_id
       AND user_id = v_actor
       AND (
         published_resource_id IS NULL
         OR published_resource_id = v_resource_id
       );

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated <> 1 THEN
      RAISE EXCEPTION 'ai_studio_source_not_found'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN v_result || jsonb_build_object(
    'private_content_saved', payload ? 'private_content',
    'source_ai_studio_draft_id', v_source_draft_id
  );
END
$$;

REVOKE ALL ON FUNCTION public.save_admin_resource_draft_v2(jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_admin_resource_draft_v2(jsonb)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_get_resource_private_content(
  p_resource_id uuid,
  p_version_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_target_version_id uuid;
  v_content_en text;
  v_content_ar text;
  v_content_format text;
  v_content_created_at timestamptz;
  v_content_updated_at timestamptz;
BEGIN
  IF v_actor IS NULL
     OR NOT public.has_role(v_actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(p_version_id, r.current_version_id)
    INTO v_target_version_id
    FROM public.resources r
   WHERE r.id = p_resource_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'resource_not_found');
  END IF;

  IF v_target_version_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'resource_id', p_resource_id,
      'resource_version_id', null,
      'content_en', null,
      'content_ar', null,
      'content_format', 'text'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.resource_versions rv
     WHERE rv.id = v_target_version_id
       AND rv.resource_id = p_resource_id
  ) THEN
    RAISE EXCEPTION 'version_resource_mismatch'
      USING ERRCODE = '23514';
  END IF;

  SELECT c.content_en, c.content_ar, c.content_format,
         c.created_at, c.updated_at
    INTO v_content_en, v_content_ar, v_content_format,
         v_content_created_at, v_content_updated_at
    FROM private.resource_version_contents c
   WHERE c.resource_version_id = v_target_version_id;

  RETURN jsonb_build_object(
    'ok', true,
    'resource_id', p_resource_id,
    'resource_version_id', v_target_version_id,
    'content_en', v_content_en,
    'content_ar', v_content_ar,
    'content_format', coalesce(v_content_format, 'text'),
    'created_at', v_content_created_at,
    'updated_at', v_content_updated_at
  );
END
$$;

REVOKE ALL ON FUNCTION public.admin_get_resource_private_content(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE
  ON FUNCTION public.admin_get_resource_private_content(uuid, uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) Entitlement-aware protected content version selection
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.v2_user_owns_resource(p_resource_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.entitlements e
     WHERE e.user_id = auth.uid()
       AND e.revoked_at IS NULL
       AND (e.expires_at IS NULL OR e.expires_at > now())
       AND (
         e.scope = 'library'::public.v2_entitlement_scope
         OR (
           e.scope = 'resource'::public.v2_entitlement_scope
           AND e.resource_id = p_resource_id
         )
         OR (
           e.scope = 'collection'::public.v2_entitlement_scope
           AND e.collection_key =
             public.v2_resource_collection_key(p_resource_id)
         )
       )
  );
$$;

REVOKE ALL ON FUNCTION public.v2_user_owns_resource(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.v2_user_owns_resource(uuid)
  TO authenticated, service_role;

-- Keep UI ownership display server-authoritative. In particular, legacy
-- platform/collection entitlements must behave like ownership everywhere
-- without teaching the browser how resources map to collections.
CREATE OR REPLACE FUNCTION public.get_my_library_state()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_progress int;
  v_ents jsonb;
  v_has_lib boolean;
  v_collections text[];
  v_owned_resource_ids uuid[];
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT LEAST(
           GREATEST(coalesce(sum(amount_fils), 0), 0),
           30000
         )::int
    INTO v_progress
    FROM public.lifetime_credit_entries
   WHERE user_id = v_user;

  SELECT EXISTS (
    SELECT 1
      FROM public.entitlements e
     WHERE e.user_id = v_user
       AND e.scope = 'library'::public.v2_entitlement_scope
       AND e.revoked_at IS NULL
       AND (e.expires_at IS NULL OR e.expires_at > now())
  ) INTO v_has_lib;

  SELECT coalesce(array_agg(DISTINCT collection_key), '{}'::text[])
    INTO v_collections
    FROM public.entitlements
   WHERE user_id = v_user
     AND scope = 'collection'::public.v2_entitlement_scope
     AND revoked_at IS NULL
     AND (expires_at IS NULL OR expires_at > now());

  SELECT coalesce(array_agg(DISTINCT owned.resource_id), '{}'::uuid[])
    INTO v_owned_resource_ids
    FROM (
      SELECT e.resource_id
        FROM public.entitlements e
       WHERE e.user_id = v_user
         AND e.scope = 'resource'::public.v2_entitlement_scope
         AND e.resource_id IS NOT NULL
         AND e.revoked_at IS NULL
         AND (e.expires_at IS NULL OR e.expires_at > now())
      UNION
      SELECT r.id
        FROM public.resources r
       WHERE cardinality(v_collections) > 0
         AND r.lifecycle IN (
           'published'::public.v2_resource_lifecycle,
           'archived'::public.v2_resource_lifecycle
         )
         AND public.v2_resource_collection_key(r.id) = ANY(v_collections)
    ) owned;

  SELECT coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb)
    INTO v_ents
    FROM (
      SELECT e.id, e.resource_id, e.scope, e.collection_key,
             e.grant_reason, e.version_major, e.granted_at, e.expires_at
        FROM public.entitlements e
       WHERE e.user_id = v_user
         AND e.revoked_at IS NULL
         AND (e.expires_at IS NULL OR e.expires_at > now())
       ORDER BY e.granted_at DESC
    ) x;

  RETURN jsonb_build_object(
    'entitlements', v_ents,
    'has_library_access', v_has_lib,
    'active_collection_keys', to_jsonb(v_collections),
    'owned_resource_ids', to_jsonb(v_owned_resource_ids),
    'lifetime_progress_fils', v_progress,
    'lifetime_threshold_fils', 30000,
    'lifetime_remaining_fils', greatest(30000 - v_progress, 0)
  );
END
$$;

REVOKE ALL ON FUNCTION public.get_my_library_state()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_library_state()
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private._v2_entitled_resource_version(
  p_resource_id uuid,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_latest_published uuid;
  v_collection_key text;
  v_version_id uuid;
BEGIN
  IF p_resource_id IS NULL OR p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT r.latest_published_version_id
    INTO v_latest_published
    FROM public.resources r
   WHERE r.id = p_resource_id
     AND r.lifecycle IN (
       'published'::public.v2_resource_lifecycle,
       'archived'::public.v2_resource_lifecycle
     );

  IF NOT FOUND OR v_latest_published IS NULL THEN
    RETURN NULL;
  END IF;

  IF public.has_role(p_user_id, 'admin'::public.app_role)
     OR public.has_role(p_user_id, 'jadmin'::public.app_role) THEN
    RETURN v_latest_published;
  END IF;

  v_collection_key := public.v2_resource_collection_key(p_resource_id);

  IF EXISTS (
    SELECT 1
      FROM public.entitlements e
     WHERE e.user_id = p_user_id
       AND e.revoked_at IS NULL
       AND (e.expires_at IS NULL OR e.expires_at > now())
       AND (
         e.scope = 'library'::public.v2_entitlement_scope
         OR (
           e.scope = 'collection'::public.v2_entitlement_scope
           AND v_collection_key IS NOT NULL
           AND e.collection_key = v_collection_key
         )
       )
  ) THEN
    RETURN v_latest_published;
  END IF;

  SELECT rv.id
    INTO v_version_id
    FROM public.resource_versions rv
   WHERE rv.resource_id = p_resource_id
     AND rv.published_at IS NOT NULL
     AND EXISTS (
       SELECT 1
         FROM public.entitlements e
        WHERE e.user_id = p_user_id
          AND e.revoked_at IS NULL
          AND (e.expires_at IS NULL OR e.expires_at > now())
          AND e.scope = 'resource'::public.v2_entitlement_scope
          AND e.resource_id = p_resource_id
          AND (
            e.version_major IS NULL
            OR e.version_major = rv.major_version
          )
     )
   ORDER BY rv.major_version DESC, rv.published_at DESC,
            rv.created_at DESC, rv.id DESC
   LIMIT 1;

  RETURN v_version_id;
END
$$;

REVOKE ALL
  ON FUNCTION private._v2_entitled_resource_version(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.v2_get_entitled_resource_content(
  p_resource_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_resource record;
  v_version record;
  v_content record;
  v_prompt record;
  v_target_version_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_resource_id IS NULL THEN
    RAISE EXCEPTION 'invalid_resource_id' USING ERRCODE = '22023';
  END IF;

  SELECT r.id, r.legacy_prompt_id, r.type::text AS resource_type,
         r.lifecycle::text AS lifecycle
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

  v_target_version_id :=
    private._v2_entitled_resource_version(p_resource_id, v_user);

  IF v_target_version_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_entitled');
  END IF;

  SELECT rv.version, rv.major_version, rv.published_at
    INTO v_version
    FROM public.resource_versions rv
   WHERE rv.id = v_target_version_id
     AND rv.resource_id = p_resource_id
     AND rv.published_at IS NOT NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'content_version_missing');
  END IF;

  SELECT c.content_en, c.content_ar, c.content_format
    INTO v_content
    FROM private.resource_version_contents c
   WHERE c.resource_version_id = v_target_version_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'kind', CASE
        WHEN v_resource.resource_type IN ('prompt','prompt_pack','image_style')
          THEN 'prompt'
        ELSE 'resource'
      END,
      'resource_id', v_resource.id,
      'resource_type', v_resource.resource_type,
      'resource_version_id', v_target_version_id,
      'version', v_version.version,
      'major_version', v_version.major_version,
      'content_format', v_content.content_format,
      -- Backward-compatible keys consumed by the current customer UI.
      'prompt_text', v_content.content_en,
      'prompt_text_ar', v_content.content_ar
    );
  END IF;

  -- Compatibility fallback during the retirement window. New V2 resources
  -- never write to public.prompts.
  IF v_resource.legacy_prompt_id IS NOT NULL THEN
    SELECT p.prompt_text, p.prompt_text_ar
      INTO v_prompt
      FROM public.prompts p
     WHERE p.id = v_resource.legacy_prompt_id;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', true,
        'kind', 'prompt',
        'resource_id', v_resource.id,
        'resource_type', v_resource.resource_type,
        'resource_version_id', v_target_version_id,
        'version', v_version.version,
        'major_version', v_version.major_version,
        'content_format', 'text',
        'prompt_text', v_prompt.prompt_text,
        'prompt_text_ar', v_prompt.prompt_text_ar
      );
    END IF;
  END IF;

  IF v_resource.resource_type IN ('skill','automation')
     AND EXISTS (
       SELECT 1
         FROM public.resource_files rf
        WHERE rf.resource_version_id = v_target_version_id
     ) THEN
    RETURN jsonb_build_object(
      'ok', true,
      'kind', 'package',
      'resource_id', v_resource.id,
      'resource_type', v_resource.resource_type,
      'resource_version_id', v_target_version_id,
      'version', v_version.version,
      'major_version', v_version.major_version,
      'prompt_text', null,
      'prompt_text_ar', null
    );
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', 'content_missing');
END
$$;

REVOKE ALL ON FUNCTION public.v2_get_entitled_resource_content(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.v2_get_entitled_resource_content(uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5) One publish validator for review and publish
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private._v2_resource_publish_errors(
  p_resource_id uuid
)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_r record;
  v_errs text[] := ARRAY[]::text[];
  v_active_products int;
  v_positive_bundle_products int;
  v_has_bad_lifetime boolean;
  v_self_included int;
  v_dup_count int;
  v_eff record;
  v_has_private_content boolean := false;
  v_has_files boolean := false;
BEGIN
  SELECT *
    INTO v_r
    FROM public.resources
   WHERE id = p_resource_id;

  IF NOT FOUND THEN
    RETURN ARRAY['resource_not_found']::text[];
  END IF;

  IF coalesce(v_r.title_en, '') = '' THEN
    v_errs := array_append(v_errs, 'missing_title_en');
  END IF;
  IF coalesce(v_r.summary_en, '') = '' THEN
    v_errs := array_append(v_errs, 'missing_summary_en');
  END IF;
  IF coalesce(v_r.description_en, '') = '' THEN
    v_errs := array_append(v_errs, 'missing_description_en');
  END IF;
  IF v_r.current_version_id IS NULL THEN
    v_errs := array_append(v_errs, 'no_current_version');
  ELSE
    SELECT EXISTS (
      SELECT 1
        FROM private.resource_version_contents c
       WHERE c.resource_version_id = v_r.current_version_id
    ) INTO v_has_private_content;

    SELECT EXISTS (
      SELECT 1
        FROM public.resource_files rf
       WHERE rf.resource_version_id = v_r.current_version_id
    ) INTO v_has_files;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.licenses l
     WHERE l.resource_id = p_resource_id
       AND length(btrim(coalesce(l.license_key, ''))) > 0
       AND length(btrim(coalesce(l.terms_en, ''))) > 0
  ) THEN
    v_errs := array_append(v_errs, 'missing_license');
  END IF;

  IF v_r.type IN ('prompt','prompt_pack','image_style')
     AND NOT v_has_private_content
     AND v_r.legacy_prompt_id IS NULL THEN
    v_errs := array_append(v_errs, 'missing_private_content');
  END IF;

  IF v_r.type IN ('skill','automation') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.platform_compatibility
       WHERE resource_id = p_resource_id
    ) THEN
      v_errs := array_append(
        v_errs,
        'missing_platform_compatibility'
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.installation_guides
       WHERE resource_id = p_resource_id
    ) THEN
      v_errs := array_append(v_errs, 'missing_installation_guide');
    END IF;

    IF v_r.type = 'skill' AND NOT v_has_files THEN
      v_errs := array_append(v_errs, 'no_package_files');
    ELSIF v_r.type = 'automation'
          AND NOT v_has_files
          AND NOT v_has_private_content THEN
      v_errs := array_append(v_errs, 'no_automation_delivery');
    END IF;

    IF v_has_files THEN
      SELECT *
        INTO v_eff
        FROM public.v2_internal_effective_scan_state(
          v_r.current_version_id
        );

      IF v_eff.effective_status <> 'clean'
         OR NOT coalesce(v_eff.coverage_valid, false) THEN
        v_errs := array_append(
          v_errs,
          'scan_not_clean:' ||
            coalesce(v_eff.effective_status, 'unscanned')
        );
      END IF;
    END IF;
  END IF;

  SELECT
    count(*) FILTER (WHERE is_active),
    bool_or(product_type::text = 'lifetime')
    INTO v_active_products, v_has_bad_lifetime
    FROM public.products
   WHERE resource_id = p_resource_id;

  IF coalesce(v_has_bad_lifetime, false) THEN
    v_errs := array_append(
      v_errs,
      'legacy_lifetime_product_present'
    );
  END IF;
  IF coalesce(v_active_products, 0) = 0 THEN
    v_errs := array_append(v_errs, 'no_active_product');
  END IF;

  IF v_r.type = 'bundle' THEN
    SELECT count(*)
      INTO v_positive_bundle_products
      FROM public.products
     WHERE resource_id = p_resource_id
       AND product_type = 'bundle'::public.v2_product_type
       AND is_active
       AND price_fils > 0;

    IF coalesce(v_positive_bundle_products, 0) = 0 THEN
      v_errs := array_append(
        v_errs,
        'bundle_requires_positive_bundle_product'
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM public.product_bundle_items pbi
        JOIN public.products p ON p.id = pbi.bundle_product_id
       WHERE p.resource_id = p_resource_id
    ) THEN
      v_errs := array_append(v_errs, 'bundle_empty');
    END IF;

    SELECT count(*)
      INTO v_self_included
      FROM public.product_bundle_items pbi
      JOIN public.products p ON p.id = pbi.bundle_product_id
     WHERE p.resource_id = p_resource_id
       AND pbi.resource_id = p_resource_id;

    IF v_self_included > 0 THEN
      v_errs := array_append(v_errs, 'bundle_self_inclusion');
    END IF;

    SELECT count(*)
      INTO v_dup_count
      FROM (
        SELECT pbi.resource_id
          FROM public.product_bundle_items pbi
          JOIN public.products p ON p.id = pbi.bundle_product_id
         WHERE p.resource_id = p_resource_id
         GROUP BY pbi.resource_id
        HAVING count(*) > 1
      ) d;

    IF v_dup_count > 0 THEN
      v_errs := array_append(v_errs, 'bundle_duplicate_item');
    END IF;
  END IF;

  RETURN v_errs;
END
$$;

REVOKE ALL ON FUNCTION private._v2_resource_publish_errors(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_publish_resource(
  p_resource_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_r record;
  v_current_published_at timestamptz;
  v_prev_lifecycle text;
  v_errs text[];
  v_action text;
BEGIN
  IF v_actor IS NULL
     OR NOT public.has_role(v_actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO v_r
    FROM public.resources
   WHERE id = p_resource_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'errors', ARRAY['resource_not_found']
    );
  END IF;

  v_prev_lifecycle := v_r.lifecycle::text;

  IF v_r.current_version_id IS NOT NULL THEN
    SELECT rv.published_at
      INTO v_current_published_at
      FROM public.resource_versions rv
     WHERE rv.id = v_r.current_version_id
       AND rv.resource_id = p_resource_id;
  END IF;

  -- True no-op only when the public pointer already targets this published
  -- current version. A published resource may still have a newer draft version.
  IF v_prev_lifecycle = 'published'
     AND v_r.latest_published_version_id = v_r.current_version_id
     AND v_current_published_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'no_change', true,
      'resource_id', p_resource_id,
      'previous_lifecycle', v_prev_lifecycle,
      'resulting_lifecycle', 'published',
      'published_version_id', v_r.latest_published_version_id
    );
  END IF;

  IF v_prev_lifecycle NOT IN ('draft','review','published') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'invalid_transition',
      'previous_lifecycle', v_prev_lifecycle,
      'attempted_action', 'publish',
      'resulting_lifecycle', 'published'
    );
  END IF;

  v_errs := private._v2_resource_publish_errors(p_resource_id);
  IF array_length(v_errs, 1) IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'validation_failed',
      'errors', v_errs
    );
  END IF;

  -- Publish the immutable version first. The deferred resource-pointer trigger
  -- then proves the pointer targets a published version owned by this resource.
  UPDATE public.resource_versions
     SET published_at = coalesce(published_at, now()),
         updated_at = now()
   WHERE id = v_r.current_version_id
     AND resource_id = p_resource_id;

  UPDATE public.resources
     SET lifecycle = 'published'::public.v2_resource_lifecycle,
         latest_published_version_id = v_r.current_version_id,
         published_at = coalesce(published_at, now()),
         archived_at = NULL,
         updated_at = now()
   WHERE id = p_resource_id;

  v_action := CASE
    WHEN v_prev_lifecycle = 'published' THEN 'publish_version'
    ELSE 'publish'
  END;

  INSERT INTO public.activity_events (
    actor_user_id,
    actor_type,
    entity_type,
    entity_id,
    action,
    metadata
  ) VALUES (
    v_actor,
    'admin',
    'resource',
    p_resource_id,
    v_action,
    jsonb_build_object(
      'previous_lifecycle', v_prev_lifecycle,
      'resulting_lifecycle', 'published',
      'version_id', v_r.current_version_id,
      'previous_published_version_id', v_r.latest_published_version_id
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'resource_id', p_resource_id,
    'previous_lifecycle', v_prev_lifecycle,
    'resulting_lifecycle', 'published',
    'published_version_id', v_r.current_version_id
  );
END
$$;

REVOKE ALL ON FUNCTION public.admin_publish_resource(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_publish_resource(uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6) Download visibility: only explicitly published versions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_downloadable_files(
  p_resource_id uuid DEFAULT NULL
)
RETURNS TABLE (
  resource_id uuid,
  resource_file_id uuid,
  file_name text,
  content_type text,
  size_bytes bigint,
  checksum text,
  version text,
  major_version integer,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    rf.id,
    rf.file_name,
    rf.content_type,
    rf.size_bytes,
    rf.checksum_sha256,
    rv.version,
    rv.major_version,
    rv.updated_at
  FROM public.resource_files rf
  JOIN public.resource_versions rv ON rv.id = rf.resource_version_id
  JOIN public.resources r ON r.id = rv.resource_id
  WHERE (p_resource_id IS NULL OR r.id = p_resource_id)
    AND r.lifecycle IN (
      'published'::public.v2_resource_lifecycle,
      'archived'::public.v2_resource_lifecycle
    )
    AND rv.published_at IS NOT NULL
    AND EXISTS (
      SELECT 1
        FROM public.entitlements e
       WHERE e.user_id = v_user
         AND e.revoked_at IS NULL
         AND (e.expires_at IS NULL OR e.expires_at > now())
         AND (
           e.scope = 'library'::public.v2_entitlement_scope
           OR (
             e.scope = 'resource'::public.v2_entitlement_scope
             AND e.resource_id = r.id
             AND (
               e.version_major IS NULL
               OR e.version_major = rv.major_version
             )
           )
           OR (
             e.scope = 'collection'::public.v2_entitlement_scope
             AND e.collection_key =
               public.v2_resource_collection_key(r.id)
           )
         )
    )
    AND EXISTS (
      SELECT 1
        FROM public.v2_internal_effective_scan_state(rv.id) eff
       WHERE eff.effective_status = 'clean'
         AND eff.coverage_valid
    );
END
$$;

REVOKE ALL ON FUNCTION public.get_my_downloadable_files(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_downloadable_files(uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.authorize_resource_download(
  p_file_id uuid,
  p_user_id uuid
)
RETURNS TABLE (
  storage_bucket text,
  storage_path text,
  file_name text,
  content_type text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_res uuid;
  v_major int;
  v_ver uuid;
  v_ck text;
  v_eff record;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT rv.resource_id, rv.major_version, rv.id
    INTO v_res, v_major, v_ver
    FROM public.resource_files rf
    JOIN public.resource_versions rv ON rv.id = rf.resource_version_id
    JOIN public.resources r ON r.id = rv.resource_id
   WHERE rf.id = p_file_id
     AND rv.published_at IS NOT NULL
     AND r.lifecycle IN (
       'published'::public.v2_resource_lifecycle,
       'archived'::public.v2_resource_lifecycle
     );

  IF v_res IS NULL THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  v_ck := public.v2_resource_collection_key(v_res);

  IF NOT EXISTS (
    SELECT 1
      FROM public.entitlements e
     WHERE e.user_id = p_user_id
       AND e.revoked_at IS NULL
       AND (e.expires_at IS NULL OR e.expires_at > now())
       AND (
         e.scope = 'library'::public.v2_entitlement_scope
         OR (
           e.scope = 'resource'::public.v2_entitlement_scope
           AND e.resource_id = v_res
           AND (
             e.version_major IS NULL
             OR e.version_major = v_major
           )
         )
         OR (
           e.scope = 'collection'::public.v2_entitlement_scope
           AND v_ck IS NOT NULL
           AND e.collection_key = v_ck
         )
       )
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO v_eff
    FROM public.v2_internal_effective_scan_state(v_ver);

  IF v_eff.effective_status <> 'clean'
     OR NOT coalesce(v_eff.coverage_valid, false) THEN
    RAISE EXCEPTION 'package unavailable' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.package_scan_items psi
     WHERE psi.package_scan_id = v_eff.latest_scan_id
       AND psi.resource_file_id = p_file_id
       AND psi.status = 'clean'
  ) THEN
    RAISE EXCEPTION 'package unavailable' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT rf.storage_bucket, rf.storage_path, rf.file_name, rf.content_type
    FROM public.resource_files rf
   WHERE rf.id = p_file_id;
END
$$;

REVOKE ALL ON FUNCTION public.authorize_resource_download(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_resource_download(uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.authorize_resource_download(
  p_file_id uuid
)
RETURNS TABLE (
  storage_bucket text,
  storage_path text,
  file_name text,
  content_type text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  SELECT *
    FROM public.authorize_resource_download(p_file_id, v_user);
END
$$;

REVOKE ALL ON FUNCTION public.authorize_resource_download(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_resource_download(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_public_resource_trust_badges(
  resource_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  resource_id uuid,
  version_id uuid,
  scan_status text,
  scanned_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    rv.id,
    eff.effective_status,
    CASE
      WHEN eff.effective_status = 'clean' AND eff.coverage_valid
        THEN eff.latest_scanned_at
      ELSE NULL
    END
  FROM public.resources r
  JOIN public.resource_versions rv
    ON rv.id = r.latest_published_version_id
   AND rv.resource_id = r.id
   AND rv.published_at IS NOT NULL
  CROSS JOIN LATERAL
    public.v2_internal_effective_scan_state(rv.id) eff
  WHERE r.lifecycle = 'published'::public.v2_resource_lifecycle
    AND (resource_ids IS NULL OR r.id = ANY(resource_ids));
END
$$;

REVOKE ALL ON FUNCTION public.get_public_resource_trust_badges(uuid[])
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_resource_trust_badges(uuid[])
  TO anon, authenticated;

COMMENT ON TABLE private.resource_version_contents IS
  'Version-scoped protected Jojo resource text. Not exposed through the Data API; reads and writes flow through entitlement/admin RPCs.';

COMMENT ON COLUMN public.resources.latest_published_version_id IS
  'Immutable public/customer delivery pointer. current_version_id remains the admin working version.';

COMMENT ON FUNCTION public.save_admin_resource_draft_v2(jsonb) IS
  'Transactional V2 publisher wrapper: public metadata/version save plus private version content and optional AI Studio lineage.';

-- Migration-time fail-closed assertions. A bad legacy row or accidental grant
-- must abort deployment before the frontend can depend on this boundary.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.resources r
     WHERE (
       r.lifecycle = 'published'::public.v2_resource_lifecycle
       OR (
         r.lifecycle = 'archived'::public.v2_resource_lifecycle
         AND r.published_at IS NOT NULL
       )
     )
       AND r.latest_published_version_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'published_or_archived_resource_missing_published_version';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.resources r
      JOIN public.resource_versions rv
        ON rv.id = r.latest_published_version_id
     WHERE rv.resource_id <> r.id
        OR rv.published_at IS NULL
  ) THEN
    RAISE EXCEPTION 'invalid_latest_published_version_pointer';
  END IF;

  IF has_table_privilege(
       'anon',
       'private.resource_version_contents',
       'SELECT'
     )
     OR has_table_privilege(
       'authenticated',
       'private.resource_version_contents',
       'SELECT'
     ) THEN
    RAISE EXCEPTION 'protected_content_table_exposed';
  END IF;

  IF has_function_privilege(
       'anon',
       'public.save_admin_resource_draft_v2(jsonb)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'anon',
       'public.admin_get_resource_private_content(uuid,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'anon',
       'public.v2_get_entitled_resource_content(uuid)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'protected_content_rpc_exposed_to_anon';
  END IF;
END
$$;
