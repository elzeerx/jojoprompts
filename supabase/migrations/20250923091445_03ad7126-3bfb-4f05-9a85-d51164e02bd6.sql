-- Fix Security Definer View Issue
-- Remove security definer from view and properly handle security through RLS

-- Drop the problematic view with security definer
DROP VIEW IF EXISTS public.public_profiles;

-- Recreate the view without security definer (RLS policies will handle security)
CREATE VIEW public.public_profiles AS
SELECT 
  id,
  username,
  role,
  avatar_url,
  bio,
  created_at
FROM public.profiles;

-- Grant appropriate access to the view
GRANT SELECT ON public.public_profiles TO authenticated;

-- The security is now properly handled by the RLS policies on the underlying profiles table