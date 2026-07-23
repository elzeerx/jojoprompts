
CREATE OR REPLACE FUNCTION public.v2_admin_backfill_legacy_prompts(p_dry_run boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_row record;
  v_res_id uuid;
  v_platform_slug text;
  v_type public.v2_resource_type;
  v_tags text[];
  v_slug text;
  v_sku text;
  v_hero text;
  v_existing_res uuid;
  v_ver_inserted int;
  v_compat_inserted int;
  v_product_inserted int;
  v_product_updated int;
  v_ver_id uuid;
  v_inserted int := 0;
  v_updated int := 0;
  v_skipped int := 0;
  v_versions_created int := 0;
  v_compat_created int := 0;
  v_products_created int := 0;
  v_products_updated int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_inserted_ids uuid[] := '{}';
  v_run_id uuid := gen_random_uuid();
BEGIN
  PERFORM public._v2_require_admin();

  FOR v_row IN
    SELECT p.id, p.title, p.title_ar, p.prompt_text, p.prompt_text_ar,
           p.image_path, p.default_image_path, p.prompt_type,
           coalesce(p.metadata,'{}'::jsonb) AS metadata,
           coalesce(p.platform_fields,'{}'::jsonb) AS platform_fields,
           p.created_at, p.platform_id, pl.slug AS platform_slug
      FROM public.prompts p
      LEFT JOIN public.platforms pl ON pl.id = p.platform_id
     ORDER BY p.created_at ASC
  LOOP
    BEGIN
      -- Type mapping
      IF v_row.prompt_type IN ('text','chatgpt-gpt-builder') THEN
        v_type := 'prompt'::public.v2_resource_type;
      ELSIF v_row.prompt_type IN ('image','midjourney-sref','gemini-image') THEN
        v_type := 'image_style'::public.v2_resource_type;
      ELSE
        v_type := 'prompt'::public.v2_resource_type;
      END IF;

      -- Platform inference (linked first, then explicit prompt_type indicators only)
      v_platform_slug := COALESCE(
        v_row.platform_slug,
        CASE v_row.prompt_type
          WHEN 'midjourney-sref' THEN 'midjourney'
          WHEN 'gemini-image'    THEN 'gemini'
          WHEN 'chatgpt-gpt-builder' THEN 'gpts-builder'
          ELSE NULL
        END
      );

      -- Tags from legacy metadata.tags
      SELECT COALESCE(array_agg(elem::text), '{}')::text[] INTO v_tags
        FROM jsonb_array_elements_text(COALESCE(v_row.metadata->'tags','[]'::jsonb)) elem;

      v_hero := COALESCE(v_row.image_path, v_row.default_image_path);

      -- Deterministic idempotency keys
      v_slug := 'legacy-' || substr(replace(v_row.id::text,'-',''), 1, 12);
      v_sku  := 'JOJO-LEGACY-' || upper(substr(replace(v_row.id::text,'-',''), 1, 8));

      SELECT id INTO v_existing_res FROM public.resources WHERE legacy_prompt_id = v_row.id;

      IF v_existing_res IS NULL THEN
        IF p_dry_run THEN
          v_inserted := v_inserted + 1;
          CONTINUE;
        END IF;

        INSERT INTO public.resources (
          slug, type, lifecycle, title_en, title_ar,
          summary_en, description_en, description_ar,
          hero_image_path, category, tags,
          legacy_prompt_id, published_at, created_at, updated_at
        ) VALUES (
          v_slug, v_type, 'published',
          v_row.title,
          NULLIF(btrim(COALESCE(v_row.title_ar,'')),''),
          LEFT(COALESCE(v_row.prompt_text,''),200),
          v_row.prompt_text,
          NULLIF(btrim(COALESCE(v_row.prompt_text_ar,'')),''),
          v_hero,
          v_row.metadata->>'category',
          v_tags,
          v_row.id,
          v_row.created_at,
          v_row.created_at,
          now()
        ) RETURNING id INTO v_res_id;

        v_inserted := v_inserted + 1;
        v_inserted_ids := v_inserted_ids || v_res_id;
      ELSE
        IF p_dry_run THEN
          v_skipped := v_skipped + 1;
          CONTINUE;
        END IF;
        v_res_id := v_existing_res;
        UPDATE public.resources SET
          title_en       = v_row.title,
          title_ar       = NULLIF(btrim(COALESCE(v_row.title_ar,'')),''),
          summary_en     = LEFT(COALESCE(v_row.prompt_text,''),200),
          description_en = v_row.prompt_text,
          description_ar = NULLIF(btrim(COALESCE(v_row.prompt_text_ar,'')),''),
          hero_image_path = COALESCE(hero_image_path, v_hero),
          category       = COALESCE(category, v_row.metadata->>'category'),
          tags           = CASE WHEN array_length(tags,1) IS NULL THEN v_tags ELSE tags END,
          updated_at     = now()
        WHERE id = v_res_id
          AND archived_at IS NULL;
        v_updated := v_updated + 1;
      END IF;

      -- Version 1 snapshot (idempotent)
      WITH ins AS (
        INSERT INTO public.resource_versions (resource_id, version, major_version, is_current, published_at, changelog_en)
        VALUES (v_res_id, '1.0.0', 1, true, v_row.created_at, 'Legacy import v1')
        ON CONFLICT (resource_id, version) DO NOTHING
        RETURNING id
      ) SELECT count(*), max(id) INTO v_ver_inserted, v_ver_id FROM ins;
      IF v_ver_inserted > 0 THEN
        v_versions_created := v_versions_created + v_ver_inserted;
        UPDATE public.resources SET current_version_id = v_ver_id
         WHERE id = v_res_id AND current_version_id IS NULL;
      END IF;

      -- Platform compatibility (only when a slug was resolved)
      IF v_platform_slug IS NOT NULL THEN
        WITH ins AS (
          INSERT INTO public.platform_compatibility (resource_id, platform_slug, is_verified, notes_en)
          VALUES (v_res_id, v_platform_slug, false, 'Imported from legacy prompt')
          ON CONFLICT (resource_id, platform_slug) DO NOTHING
          RETURNING id
        ) SELECT count(*) INTO v_compat_inserted FROM ins;
        v_compat_created := v_compat_created + v_compat_inserted;
      END IF;

      -- Individual product at 900 fils (idempotent upsert by SKU)
      WITH ins AS (
        INSERT INTO public.products (sku, product_type, resource_id, title_en, title_ar, price_fils, currency, is_active)
        VALUES (v_sku, 'individual', v_res_id, v_row.title,
                NULLIF(btrim(COALESCE(v_row.title_ar,'')),''), 900, 'KWD', true)
        ON CONFLICT (sku) DO NOTHING
        RETURNING id
      ) SELECT count(*) INTO v_product_inserted FROM ins;
      IF v_product_inserted > 0 THEN
        v_products_created := v_products_created + 1;
      ELSE
        UPDATE public.products
           SET title_en    = v_row.title,
               title_ar    = NULLIF(btrim(COALESCE(v_row.title_ar,'')),''),
               resource_id = v_res_id,
               is_active   = true,
               updated_at  = now()
         WHERE sku = v_sku
           AND (title_en <> v_row.title
                OR resource_id IS DISTINCT FROM v_res_id
                OR is_active = false);
        GET DIAGNOSTICS v_product_updated = ROW_COUNT;
        v_products_updated := v_products_updated + COALESCE(v_product_updated,0);
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object(
        'legacy_prompt_id', v_row.id,
        'title', v_row.title,
        'sqlstate', SQLSTATE,
        'error', SQLERRM
      );
    END;
  END LOOP;

  IF NOT p_dry_run THEN
    INSERT INTO public.activity_events (actor_user_id, actor_type, entity_type, entity_id, action, metadata)
    VALUES (
      v_actor, 'admin', 'v2_backfill_run', NULL, 'v2_legacy_prompts_backfill',
      jsonb_build_object(
        'run_id', v_run_id,
        'inserted', v_inserted,
        'updated', v_updated,
        'skipped', v_skipped,
        'versions_created', v_versions_created,
        'compat_created', v_compat_created,
        'products_created', v_products_created,
        'products_updated', v_products_updated,
        'errors', v_errors,
        'inserted_resource_ids', to_jsonb(v_inserted_ids),
        'rollback_hint', 'Delete public.resources where id = ANY(inserted_resource_ids); dependent version/compat/product rows cascade via SKU JOJO-LEGACY-* and legacy_prompt_id lookups.'
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'run_id', v_run_id,
    'dry_run', p_dry_run,
    'inserted', v_inserted,
    'updated', v_updated,
    'skipped', v_skipped,
    'versions_created', v_versions_created,
    'compat_created', v_compat_created,
    'products_created', v_products_created,
    'products_updated', v_products_updated,
    'errors', v_errors,
    'inserted_resource_ids', to_jsonb(v_inserted_ids)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.v2_admin_backfill_legacy_prompts(boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.v2_admin_backfill_legacy_prompts(boolean) FROM anon;
REVOKE ALL ON FUNCTION public.v2_admin_backfill_legacy_prompts(boolean) FROM service_role;
GRANT EXECUTE ON FUNCTION public.v2_admin_backfill_legacy_prompts(boolean) TO authenticated;
