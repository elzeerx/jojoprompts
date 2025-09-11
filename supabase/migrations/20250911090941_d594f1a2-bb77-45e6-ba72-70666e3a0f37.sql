-- Update the preview function to return multiple prompts for marketing
DROP FUNCTION IF EXISTS public.get_public_prompt_preview(uuid);

-- Create a function that returns preview data for multiple prompts
CREATE OR REPLACE FUNCTION public.get_public_prompt_previews(limit_count integer DEFAULT 12)
RETURNS TABLE(
  id uuid,
  title text,
  prompt_preview text,
  prompt_type text,
  image_path text,
  default_image_path text,
  category text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.title,
    -- Only return first 50 characters as preview for unauthenticated users
    LEFT(p.prompt_text, 50) || CASE WHEN LENGTH(p.prompt_text) > 50 THEN '...' ELSE '' END as prompt_preview,
    p.prompt_type,
    p.image_path,
    p.default_image_path,
    COALESCE(p.metadata->>'category', 'Uncategorized') as category,
    p.created_at
  FROM public.prompts p
  ORDER BY p.created_at DESC
  LIMIT limit_count;
END;
$$;

COMMENT ON FUNCTION public.get_public_prompt_previews(integer) IS 
'Provides limited prompt preview data for marketing purposes to unauthenticated users - returns multiple prompts';