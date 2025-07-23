
-- Create tables for prompt generator dynamic management

-- Table to store prompt generation models
CREATE TABLE public.prompt_generator_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('image', 'video')),
  parameters JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table to store dynamic field options
CREATE TABLE public.prompt_generator_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_category TEXT NOT NULL CHECK (field_category IN ('style', 'subject', 'effects')),
  field_name TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('dropdown', 'text', 'textarea', 'multiselect')),
  options JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table to store user-created templates
CREATE TABLE public.prompt_generator_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  template_data JSONB NOT NULL,
  model_type TEXT NOT NULL CHECK (model_type IN ('image', 'video')),
  is_public BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.prompt_generator_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_generator_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_generator_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for prompt_generator_models
CREATE POLICY "Admins and prompters can view all models"
ON public.prompt_generator_models
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'prompter', 'jadmin')
  )
);

CREATE POLICY "Admins and prompters can manage models"
ON public.prompt_generator_models
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'prompter', 'jadmin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'prompter', 'jadmin')
  )
);

-- RLS policies for prompt_generator_fields
CREATE POLICY "Admins and prompters can view all fields"
ON public.prompt_generator_fields
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'prompter', 'jadmin')
  )
);

CREATE POLICY "Admins and prompters can manage fields"
ON public.prompt_generator_fields
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'prompter', 'jadmin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'prompter', 'jadmin')
  )
);

-- RLS policies for prompt_generator_templates
CREATE POLICY "Users can view public templates and own templates"
ON public.prompt_generator_templates
FOR SELECT
USING (
  is_public = true OR 
  created_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'prompter', 'jadmin')
  )
);

CREATE POLICY "Admins and prompters can manage templates"
ON public.prompt_generator_templates
FOR ALL
USING (
  created_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'prompter', 'jadmin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'prompter', 'jadmin')
  )
);

-- Insert default models
INSERT INTO public.prompt_generator_models (name, type, parameters, created_by) VALUES
('Midjourney', 'image', '{"aspect_ratio": ["1:1", "4:3", "16:9", "9:16"], "stylize": {"min": 0, "max": 1000, "default": 100}, "chaos": {"min": 0, "max": 100, "default": 0}, "version": ["6.1", "6.0", "5.2", "5.1"], "style": ["raw", "default"]}', (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1)),
('FLUX', 'image', '{"guidance_scale": {"min": 1, "max": 20, "default": 7.5}, "num_inference_steps": {"min": 1, "max": 100, "default": 50}, "seed": {"min": 0, "max": 2147483647}}', (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1)),
('Runway', 'video', '{"duration": {"min": 2, "max": 10, "default": 5}, "fps": [24, 30, 60], "resolution": ["720p", "1080p", "4K"]}', (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1)),
('Sora', 'video', '{"duration": {"min": 1, "max": 60, "default": 10}, "aspect_ratio": ["16:9", "9:16", "1:1"], "quality": ["standard", "high"]}', (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1));

-- Insert default fields
INSERT INTO public.prompt_generator_fields (field_category, field_name, field_type, options, display_order, created_by) VALUES
('style', 'genre', 'dropdown', '["futuristic sci-fi", "fantasy", "realistic", "abstract", "minimalist", "vintage", "cyberpunk", "steampunk", "noir", "romantic"]', 1, (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1)),
('style', 'photography_style', 'dropdown', '["low-key photograph", "cinematic", "portrait", "landscape", "street photography", "macro", "documentary", "fashion", "architectural"]', 2, (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1)),
('style', 'medium', 'dropdown', '["cinematic", "digital art", "oil painting", "watercolor", "pencil sketch", "acrylic", "photography", "3D render", "pixel art", "vector art"]', 3, (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1)),
('subject', 'shot_type', 'dropdown', '["wide shot", "close-up", "medium shot", "extreme close-up", "bird''s eye view", "worm''s eye view", "over-the-shoulder", "establishing shot"]', 1, (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1)),
('subject', 'emotions', 'dropdown', '["angry", "happy", "sad", "excited", "calm", "surprised", "confused", "determined", "peaceful", "intense"]', 2, (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1)),
('effects', 'lighting', 'dropdown', '["sunset golden hour", "dramatic lighting", "soft lighting", "harsh lighting", "backlighting", "rim lighting", "studio lighting", "natural lighting", "neon lighting"]', 1, (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1)),
('effects', 'color', 'dropdown', '["dark blue and orange", "vibrant colors", "monochrome", "pastel colors", "high contrast", "warm tones", "cool tones", "earth tones", "neon colors"]', 2, (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1)),
('effects', 'camera_lens', 'dropdown', '["ultra wide angle", "macro", "telephoto", "fisheye", "prime lens", "zoom lens", "tilt-shift", "wide angle"]', 3, (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1)),
('effects', 'modifier', 'dropdown', '["ultra detailed", "4K", "8K", "HDR", "hyper realistic", "stylized", "minimalist", "maximalist", "ethereal", "gritty"]', 4, (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1));

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_prompt_generator_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER update_prompt_generator_models_updated_at
  BEFORE UPDATE ON public.prompt_generator_models
  FOR EACH ROW
  EXECUTE FUNCTION public.update_prompt_generator_updated_at();

CREATE TRIGGER update_prompt_generator_fields_updated_at
  BEFORE UPDATE ON public.prompt_generator_fields
  FOR EACH ROW
  EXECUTE FUNCTION public.update_prompt_generator_updated_at();

CREATE TRIGGER update_prompt_generator_templates_updated_at
  BEFORE UPDATE ON public.prompt_generator_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_prompt_generator_updated_at();
