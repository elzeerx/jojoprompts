-- Drop existing policies if they exist
DROP POLICY IF EXISTS "platforms_select_all" ON public.platforms;
DROP POLICY IF EXISTS "platforms_insert_admin" ON public.platforms;
DROP POLICY IF EXISTS "platforms_update_admin" ON public.platforms;
DROP POLICY IF EXISTS "platforms_delete_admin" ON public.platforms;
DROP POLICY IF EXISTS "platform_fields_select_all" ON public.platform_fields;
DROP POLICY IF EXISTS "platform_fields_insert_admin" ON public.platform_fields;
DROP POLICY IF EXISTS "platform_fields_update_admin" ON public.platform_fields;
DROP POLICY IF EXISTS "platform_fields_delete_admin" ON public.platform_fields;
DROP POLICY IF EXISTS "prompt_templates_select_all" ON public.prompt_templates;
DROP POLICY IF EXISTS "prompt_templates_insert_admin" ON public.prompt_templates;
DROP POLICY IF EXISTS "prompt_templates_update_admin" ON public.prompt_templates;
DROP POLICY IF EXISTS "prompt_templates_delete_admin" ON public.prompt_templates;

-- Create new policies
CREATE POLICY "platforms_select_all" ON public.platforms FOR SELECT USING (true);
CREATE POLICY "platforms_insert_admin" ON public.platforms FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "platforms_update_admin" ON public.platforms FOR UPDATE USING (is_admin());
CREATE POLICY "platforms_delete_admin" ON public.platforms FOR DELETE USING (is_admin());

CREATE POLICY "platform_fields_select_all" ON public.platform_fields FOR SELECT USING (true);
CREATE POLICY "platform_fields_insert_admin" ON public.platform_fields FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "platform_fields_update_admin" ON public.platform_fields FOR UPDATE USING (is_admin());
CREATE POLICY "platform_fields_delete_admin" ON public.platform_fields FOR DELETE USING (is_admin());

CREATE POLICY "prompt_templates_select_all" ON public.prompt_templates FOR SELECT USING (true);
CREATE POLICY "prompt_templates_insert_admin" ON public.prompt_templates FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "prompt_templates_update_admin" ON public.prompt_templates FOR UPDATE USING (is_admin());
CREATE POLICY "prompt_templates_delete_admin" ON public.prompt_templates FOR DELETE USING (is_admin());