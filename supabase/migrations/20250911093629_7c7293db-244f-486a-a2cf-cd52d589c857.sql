-- Remove conflicting prompts policy that blocks all public access
DROP POLICY IF EXISTS "Public users can view limited prompt previews" ON public.prompts;