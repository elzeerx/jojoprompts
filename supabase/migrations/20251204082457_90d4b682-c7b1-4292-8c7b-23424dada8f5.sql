-- First, drop the existing check constraint and add an updated one with new categories
ALTER TABLE platforms DROP CONSTRAINT IF EXISTS platforms_category_check;

ALTER TABLE platforms ADD CONSTRAINT platforms_category_check 
CHECK (category IN ('text-to-text', 'text-to-image', 'text-to-video', 'text-to-audio', 'text-to-code', 'workflow', 'research'));

-- Now insert new AI platforms
INSERT INTO platforms (name, slug, category, description, icon, display_order, is_active)
VALUES 
  ('Gemini', 'gemini', 'text-to-image', 'Google Gemini AI including Nano Banana image generation', 'Sparkles', 5, true),
  ('GPTs Builder', 'gpts-builder', 'text-to-text', 'Custom GPT creation prompts for ChatGPT', 'Bot', 6, true),
  ('Flux', 'flux', 'text-to-image', 'Open-source image generation with Flux and Stable Diffusion', 'Wand2', 7, true),
  ('Sora', 'sora', 'text-to-video', 'OpenAI video generation', 'Video', 8, true),
  ('ElevenLabs', 'elevenlabs', 'text-to-audio', 'AI voice generation and cloning', 'Mic', 9, true),
  ('Suno', 'suno', 'text-to-audio', 'AI music and song generation', 'Music', 10, true),
  ('Ideogram', 'ideogram', 'text-to-image', 'Image generation with excellent text rendering', 'Type', 11, true),
  ('Runway', 'runway', 'text-to-video', 'Professional video generation with Gen-3 Alpha', 'Film', 12, true),
  ('Cursor', 'cursor', 'text-to-code', 'AI-powered code assistant prompts', 'Code', 13, true),
  ('Perplexity', 'perplexity', 'research', 'AI-powered research assistant', 'Search', 14, true)
ON CONFLICT (slug) DO NOTHING;

-- Add new categories for browsing
INSERT INTO categories (name, description, link_path, display_order, is_active, required_plan, icon_name, bg_gradient)
VALUES
  ('Gemini', 'Google Gemini AI and Nano Banana image generation prompts', '/prompts/gemini', 5, true, 'standard', 'Sparkles', 'from-blue-500/20 via-blue-400/10 to-transparent'),
  ('GPTs Builder', 'Custom GPT creation and configuration prompts', '/prompts/gpts-builder', 6, true, 'standard', 'Bot', 'from-green-500/20 via-green-400/10 to-transparent'),
  ('Flux', 'Flux and Stable Diffusion image generation prompts', '/prompts/flux', 7, true, 'standard', 'Wand2', 'from-purple-500/20 via-purple-400/10 to-transparent'),
  ('Video AI', 'Video generation prompts for Sora, Runway, and more', '/prompts/video-ai', 8, true, 'premium', 'Video', 'from-red-500/20 via-red-400/10 to-transparent'),
  ('Audio AI', 'Voice and music generation prompts for ElevenLabs, Suno', '/prompts/audio-ai', 9, true, 'premium', 'Music', 'from-orange-500/20 via-orange-400/10 to-transparent'),
  ('Code AI', 'Coding assistant prompts for Cursor, Copilot, and more', '/prompts/code-ai', 10, true, 'standard', 'Code', 'from-cyan-500/20 via-cyan-400/10 to-transparent')
ON CONFLICT DO NOTHING;