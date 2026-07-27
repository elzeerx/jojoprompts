-- Corrective reproducibility migration for V2 content protection.
-- Live prod already has archive + safe copy + revokes applied; every
-- statement below is idempotent and guarded so applying here is a
-- no-op on live and fully reproduces the state on a fresh DB.

-- 1. Archive originals for every migrated resource. ON CONFLICT DO
-- NOTHING preserves already-archived originals.
INSERT INTO public.resource_legacy_content_archive (
  resource_id, legacy_prompt_id,
  summary_en, summary_ar, description_en, description_ar
)
SELECT
  r.id, r.legacy_prompt_id,
  r.summary_en, r.summary_ar, r.description_en, r.description_ar
FROM public.resources r
WHERE r.legacy_prompt_id IS NOT NULL
ON CONFLICT (resource_id) DO NOTHING;

-- 2. Guarded safe-copy replacement. Only overwrite when the current
-- values still equal the archived ORIGINAL values, so rerunning is a
-- no-op and admin-edited copy is left untouched. Bilingual public
-- product copy mirrors the live migration exactly (prompt vs
-- image_style variants).
UPDATE public.resources r
SET
  summary_en = CASE r.type::text
    WHEN 'image_style' THEN
      'A JojoPrompts image style for creating ' || COALESCE(r.title_en, 'this style') ||
      ' visuals. Acquire it to unlock the complete prompt.'
    ELSE
      'A ready-to-use JojoPrompts prompt for ' || COALESCE(r.title_en, 'this workflow') ||
      '. Acquire it to unlock the complete prompt.'
  END,
  summary_ar = CASE r.type::text
    WHEN 'image_style' THEN
      'نمط صور من JojoPrompts لإنشاء نتائج ' || COALESCE(r.title_en, '') ||
      '. احصل عليه لفتح البرومبت الكامل.'
    ELSE
      'برومبت جاهز من JojoPrompts لمساعدتك في ' || COALESCE(r.title_en, '') ||
      '. احصل عليه لفتح البرومبت الكامل.'
  END,
  description_en = CASE r.type::text
    WHEN 'image_style' THEN
      'Preview the intended style, compatibility, version, license, and ownership options here. The complete reusable image prompt is revealed only after this resource is acquired or included through Full Library Lifetime access.'
    ELSE
      'Review the outcome, compatibility, version, license, and ownership options here. The complete reusable prompt is revealed only after this resource is acquired or included through Full Library Lifetime access.'
  END,
  description_ar = CASE r.type::text
    WHEN 'image_style' THEN
      'استعرض النمط المقصود والتوافق والإصدار والترخيص وخيارات الملكية. يظهر برومبت الصور الكامل فقط بعد الحصول على هذا المورد أو من خلال وصول المكتبة الكاملة مدى الحياة.'
    ELSE
      'استعرض النتيجة والتوافق والإصدار والترخيص وخيارات الملكية. يظهر البرومبت الكامل فقط بعد الحصول على هذا المورد أو من خلال وصول المكتبة الكاملة مدى الحياة.'
  END
FROM public.resource_legacy_content_archive a
WHERE a.resource_id = r.id
  AND r.legacy_prompt_id IS NOT NULL
  AND r.summary_en     IS NOT DISTINCT FROM a.summary_en
  AND r.summary_ar     IS NOT DISTINCT FROM a.summary_ar
  AND r.description_en IS NOT DISTINCT FROM a.description_en
  AND r.description_ar IS NOT DISTINCT FROM a.description_ar;

-- 3. Explicitly drop the exact broad legacy prompt SELECT policies
-- named in the corrective spec, plus any aliases.
DROP POLICY IF EXISTS "anonymous_limited_prompts_view"        ON public.prompts;
DROP POLICY IF EXISTS "authenticated_users_can_read_prompts"  ON public.prompts;
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

-- 4. Fail-closed table grant: anon must have no read access. Authenticated
-- retains SELECT subject to RLS (entitled + admin/prompter policies).
REVOKE SELECT ON public.prompts FROM anon;

-- 5. Reassert entitlement-gated policy (idempotent).
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

-- 6. Reassert RPC EXECUTE surface (idempotent).
REVOKE ALL ON FUNCTION public.v2_get_entitled_resource_content(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.v2_get_entitled_resource_content(uuid) TO authenticated, service_role;
