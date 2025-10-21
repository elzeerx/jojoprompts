-- =====================================================
-- PHASE 1: Platform-Driven Dynamic Prompt Creation System
-- =====================================================

-- 1. CREATE PLATFORMS TABLE
CREATE TABLE IF NOT EXISTS public.platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('text-to-text', 'text-to-image', 'text-to-video', 'workflow', 'other')),
  icon TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platforms_slug ON public.platforms(slug);
CREATE INDEX IF NOT EXISTS idx_platforms_active ON public.platforms(is_active) WHERE is_active = true;

-- 2. CREATE PLATFORM_FIELDS TABLE
CREATE TABLE IF NOT EXISTS public.platform_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'textarea', 'select', 'number', 'slider', 'toggle', 'code')),
  label TEXT NOT NULL,
  placeholder TEXT,
  default_value TEXT,
  is_required BOOLEAN DEFAULT false,
  validation_rules JSONB DEFAULT '{}',
  options JSONB DEFAULT '[]',
  help_text TEXT,
  display_order INTEGER DEFAULT 0,
  conditional_logic JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(platform_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_platform_fields_platform ON public.platform_fields(platform_id);
CREATE INDEX IF NOT EXISTS idx_platform_fields_order ON public.platform_fields(platform_id, display_order);

-- 3. CREATE PROMPT_TEMPLATES TABLE
CREATE TABLE IF NOT EXISTS public.prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  template_values JSONB DEFAULT '{}',
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prompt_templates_platform ON public.prompt_templates(platform_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_featured ON public.prompt_templates(is_featured) WHERE is_featured = true;

-- 4. UPDATE PROMPTS TABLE
ALTER TABLE public.prompts 
  ADD COLUMN IF NOT EXISTS platform_id UUID REFERENCES public.platforms(id),
  ADD COLUMN IF NOT EXISTS platform_fields JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS title_ar TEXT,
  ADD COLUMN IF NOT EXISTS prompt_text_ar TEXT;

CREATE INDEX IF NOT EXISTS idx_prompts_platform ON public.prompts(platform_id);

-- 5. RLS POLICIES
ALTER TABLE public.platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;

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

-- 6. SEED DATA - PLATFORMS
INSERT INTO public.platforms (name, slug, category, icon, description, is_active, display_order)
VALUES 
  ('ChatGPT', 'chatgpt', 'text-to-text', 'MessageSquare', 'Create conversational AI prompts for ChatGPT and GPT models', true, 1),
  ('Midjourney', 'midjourney', 'text-to-image', 'Image', 'Create image generation prompts for Midjourney AI', true, 2),
  ('Claude', 'claude', 'text-to-text', 'Sparkles', 'Create prompts for Claude AI by Anthropic', true, 3),
  ('n8n Workflow', 'n8n', 'workflow', 'Workflow', 'Create and manage n8n automation workflow prompts', true, 4)
ON CONFLICT (slug) DO NOTHING;

-- 7. SEED CHATGPT FIELDS
INSERT INTO public.platform_fields (platform_id, field_key, field_type, label, is_required, options, default_value, help_text, display_order)
SELECT id, 'model', 'select', 'Model', true, 
  '[{"label": "GPT-4o", "value": "gpt-4o"},{"label": "GPT-4 Turbo", "value": "gpt-4-turbo"},{"label": "GPT-4", "value": "gpt-4"},{"label": "GPT-3.5 Turbo", "value": "gpt-3.5-turbo"}]'::jsonb,
  'gpt-4o', 'Select the OpenAI model to use', 1
FROM public.platforms WHERE slug = 'chatgpt'
ON CONFLICT (platform_id, field_key) DO NOTHING;

INSERT INTO public.platform_fields (platform_id, field_key, field_type, label, is_required, validation_rules, default_value, help_text, display_order)
SELECT id, 'temperature', 'slider', 'Temperature', false,
  '{"min": 0, "max": 2, "step": 0.1}'::jsonb, '0.7', 'Controls randomness. Lower values are more focused and deterministic.', 2
FROM public.platforms WHERE slug = 'chatgpt'
ON CONFLICT (platform_id, field_key) DO NOTHING;

INSERT INTO public.platform_fields (platform_id, field_key, field_type, label, is_required, validation_rules, default_value, help_text, display_order)
SELECT id, 'max_tokens', 'number', 'Max Tokens', false,
  '{"min": 1, "max": 128000}'::jsonb, '4096', 'Maximum length of the response', 3
FROM public.platforms WHERE slug = 'chatgpt'
ON CONFLICT (platform_id, field_key) DO NOTHING;

INSERT INTO public.platform_fields (platform_id, field_key, field_type, label, is_required, placeholder, help_text, display_order)
SELECT id, 'system_message', 'textarea', 'System Message', false,
  'You are a helpful assistant...', 'Set the behavior and context for the AI', 4
FROM public.platforms WHERE slug = 'chatgpt'
ON CONFLICT (platform_id, field_key) DO NOTHING;

INSERT INTO public.platform_fields (platform_id, field_key, field_type, label, is_required, options, default_value, display_order)
SELECT id, 'response_format', 'select', 'Response Format', false,
  '[{"label": "Text", "value": "text"},{"label": "JSON", "value": "json"}]'::jsonb, 'text', 5
FROM public.platforms WHERE slug = 'chatgpt'
ON CONFLICT (platform_id, field_key) DO NOTHING;

-- 8. SEED MIDJOURNEY FIELDS
INSERT INTO public.platform_fields (platform_id, field_key, field_type, label, is_required, options, default_value, display_order)
SELECT id, 'version', 'select', 'Version', true,
  '[{"label": "V6.1", "value": "v6.1"},{"label": "V6", "value": "v6"},{"label": "V5.2", "value": "v5.2"},{"label": "Niji 6", "value": "niji6"}]'::jsonb, 'v6.1', 1
FROM public.platforms WHERE slug = 'midjourney'
ON CONFLICT (platform_id, field_key) DO NOTHING;

INSERT INTO public.platform_fields (platform_id, field_key, field_type, label, is_required, options, default_value, display_order)
SELECT id, 'aspect_ratio', 'select', 'Aspect Ratio', true,
  '[{"label": "1:1 (Square)", "value": "1:1"},{"label": "16:9 (Landscape)", "value": "16:9"},{"label": "9:16 (Portrait)", "value": "9:16"},{"label": "4:3", "value": "4:3"},{"label": "3:2", "value": "3:2"}]'::jsonb, '1:1', 2
FROM public.platforms WHERE slug = 'midjourney'
ON CONFLICT (platform_id, field_key) DO NOTHING;

INSERT INTO public.platform_fields (platform_id, field_key, field_type, label, is_required, validation_rules, default_value, help_text, display_order)
SELECT id, 'stylize', 'slider', 'Stylization', false,
  '{"min": 0, "max": 1000, "step": 50}'::jsonb, '100', 'How strongly Midjourney''s default aesthetic is applied (0-1000)', 3
FROM public.platforms WHERE slug = 'midjourney'
ON CONFLICT (platform_id, field_key) DO NOTHING;

INSERT INTO public.platform_fields (platform_id, field_key, field_type, label, is_required, validation_rules, default_value, help_text, display_order)
SELECT id, 'chaos', 'slider', 'Chaos', false,
  '{"min": 0, "max": 100, "step": 5}'::jsonb, '0', 'Controls variation in results (0-100)', 4
FROM public.platforms WHERE slug = 'midjourney'
ON CONFLICT (platform_id, field_key) DO NOTHING;

INSERT INTO public.platform_fields (platform_id, field_key, field_type, label, is_required, options, default_value, display_order)
SELECT id, 'quality', 'select', 'Quality', false,
  '[{"label": "Standard (.25)", "value": ".25"},{"label": "High (.5)", "value": ".5"},{"label": "Very High (1)", "value": "1"}]'::jsonb, '1', 5
FROM public.platforms WHERE slug = 'midjourney'
ON CONFLICT (platform_id, field_key) DO NOTHING;

INSERT INTO public.platform_fields (platform_id, field_key, field_type, label, is_required, placeholder, help_text, display_order)
SELECT id, 'additional_parameters', 'text', 'Additional Parameters', false,
  '--weird 100 --tile', 'Advanced Midjourney parameters', 6
FROM public.platforms WHERE slug = 'midjourney'
ON CONFLICT (platform_id, field_key) DO NOTHING;

-- 9. SEED CLAUDE FIELDS
INSERT INTO public.platform_fields (platform_id, field_key, field_type, label, is_required, options, default_value, display_order)
SELECT id, 'model', 'select', 'Model', true,
  '[{"label": "Claude Sonnet 4.5", "value": "claude-sonnet-4-5"},{"label": "Claude Opus 4", "value": "claude-opus-4"},{"label": "Claude Sonnet 3.5", "value": "claude-3-5-sonnet"}]'::jsonb, 'claude-sonnet-4-5', 1
FROM public.platforms WHERE slug = 'claude'
ON CONFLICT (platform_id, field_key) DO NOTHING;

INSERT INTO public.platform_fields (platform_id, field_key, field_type, label, is_required, validation_rules, default_value, help_text, display_order)
SELECT id, 'max_tokens', 'number', 'Max Tokens', false,
  '{"min": 1, "max": 200000}'::jsonb, '4096', 'Maximum length of the response', 2
FROM public.platforms WHERE slug = 'claude'
ON CONFLICT (platform_id, field_key) DO NOTHING;

INSERT INTO public.platform_fields (platform_id, field_key, field_type, label, is_required, validation_rules, default_value, help_text, display_order)
SELECT id, 'temperature', 'slider', 'Temperature', false,
  '{"min": 0, "max": 1, "step": 0.1}'::jsonb, '1', 'Controls randomness (0-1)', 3
FROM public.platforms WHERE slug = 'claude'
ON CONFLICT (platform_id, field_key) DO NOTHING;

INSERT INTO public.platform_fields (platform_id, field_key, field_type, label, is_required, placeholder, help_text, display_order)
SELECT id, 'system_prompt', 'textarea', 'System Prompt', false,
  'You are a helpful AI assistant...', 'Set the behavior and context for Claude', 4
FROM public.platforms WHERE slug = 'claude'
ON CONFLICT (platform_id, field_key) DO NOTHING;

-- 10. SEED N8N FIELDS
INSERT INTO public.platform_fields (platform_id, field_key, field_type, label, is_required, options, default_value, display_order)
SELECT id, 'workflow_type', 'select', 'Workflow Type', true,
  '[{"label": "API Integration", "value": "api"},{"label": "Data Processing", "value": "data"},{"label": "Email Automation", "value": "email"},{"label": "Webhook Trigger", "value": "webhook"}]'::jsonb, 'api', 1
FROM public.platforms WHERE slug = 'n8n'
ON CONFLICT (platform_id, field_key) DO NOTHING;

INSERT INTO public.platform_fields (platform_id, field_key, field_type, label, is_required, options, default_value, display_order)
SELECT id, 'trigger_type', 'select', 'Trigger Type', true,
  '[{"label": "Webhook", "value": "webhook"},{"label": "Schedule (Cron)", "value": "schedule"},{"label": "Manual", "value": "manual"}]'::jsonb, 'webhook', 2
FROM public.platforms WHERE slug = 'n8n'
ON CONFLICT (platform_id, field_key) DO NOTHING;

INSERT INTO public.platform_fields (platform_id, field_key, field_type, label, is_required, placeholder, display_order)
SELECT id, 'description', 'textarea', 'Workflow Description', false,
  'Describe what this workflow does...', 3
FROM public.platforms WHERE slug = 'n8n'
ON CONFLICT (platform_id, field_key) DO NOTHING;

INSERT INTO public.platform_fields (platform_id, field_key, field_type, label, is_required, placeholder, help_text, display_order)
SELECT id, 'workflow_json', 'code', 'Workflow JSON', false,
  'Paste your n8n workflow JSON here...', 'Optional: Include the complete n8n workflow configuration', 4
FROM public.platforms WHERE slug = 'n8n'
ON CONFLICT (platform_id, field_key) DO NOTHING;

-- 11. TRIGGERS
CREATE OR REPLACE FUNCTION public.update_platform_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_platforms_updated_at ON public.platforms;
CREATE TRIGGER trigger_update_platforms_updated_at
  BEFORE UPDATE ON public.platforms
  FOR EACH ROW EXECUTE FUNCTION public.update_platform_updated_at();

DROP TRIGGER IF EXISTS trigger_update_platform_fields_updated_at ON public.platform_fields;
CREATE TRIGGER trigger_update_platform_fields_updated_at
  BEFORE UPDATE ON public.platform_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_platform_updated_at();