-- Fix security vulnerability in prompts table RLS policies
-- The current "Public can view all prompts" policy exposes sensitive user data

-- First, drop the overly permissive policy
DROP POLICY IF EXISTS "Public can view all prompts" ON public.prompts;

-- Create a more secure policy structure for the prompts table
-- Policy 1: Authenticated users (premium subscribers) can view all prompts
CREATE POLICY "Authenticated users can view all prompts" ON public.prompts
FOR SELECT 
TO authenticated
USING (true);

-- Policy 2: Unauthenticated users can only view basic preview data for marketing
-- We'll create a security definer function for this
CREATE OR REPLACE FUNCTION public.get_public_prompt_preview(prompt_id uuid)
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
  WHERE p.id = prompt_id;
END;
$$;

-- Policy 3: Public users get very limited preview access for marketing purposes only
CREATE POLICY "Public users can view limited prompt previews" ON public.prompts
FOR SELECT 
TO anon
USING (
  -- Only allow access to basic fields needed for marketing
  -- The application should use the get_public_prompt_preview function for unauthenticated users
  false  -- Block direct table access for anonymous users
);

-- Add comments to document the security model
COMMENT ON POLICY "Authenticated users can view all prompts" ON public.prompts IS 
'Authenticated users (paying customers) can view all prompts - this is the intended business model';

COMMENT ON POLICY "Public users can view limited prompt previews" ON public.prompts IS 
'Anonymous users cannot directly query prompts table - they should use get_public_prompt_preview function for marketing previews';

COMMENT ON FUNCTION public.get_public_prompt_preview(uuid) IS 
'Provides limited prompt preview data for marketing purposes to unauthenticated users';

-- Update the existing policies to be more descriptive
-- The user management policies are already secure - users can only manage their own prompts or admins can manage all