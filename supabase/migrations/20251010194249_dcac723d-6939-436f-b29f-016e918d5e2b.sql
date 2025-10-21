-- Data Migration: Set default platform for existing prompts
-- This migration safely updates existing prompts to use ChatGPT as default platform
-- and extracts metadata into platform_fields where applicable

-- Step 1: Update all prompts without a platform_id to use ChatGPT
UPDATE public.prompts
SET platform_id = (
  SELECT id FROM public.platforms WHERE slug = 'chatgpt' LIMIT 1
)
WHERE platform_id IS NULL;

-- Step 2: For prompts with metadata, try to extract relevant fields to platform_fields
-- This is a best-effort migration that maps common metadata fields
UPDATE public.prompts
SET platform_fields = jsonb_build_object(
  'model', COALESCE(metadata->>'model', 'gpt-4o'),
  'temperature', COALESCE(metadata->>'temperature', '0.7'),
  'max_tokens', COALESCE(metadata->>'max_tokens', '4096')
)
WHERE metadata IS NOT NULL 
  AND metadata != '{}'::jsonb
  AND platform_id = (SELECT id FROM public.platforms WHERE slug = 'chatgpt' LIMIT 1)
  AND platform_fields = '{}'::jsonb;

-- Step 3: Set version to 1 for all existing prompts
UPDATE public.prompts
SET version = 1
WHERE version IS NULL;