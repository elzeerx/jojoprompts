-- Fix security definer views issue
-- Drop the security definer views as they bypass RLS policies

DROP VIEW IF EXISTS public.safe_public_profiles;
DROP VIEW IF EXISTS public.public_profiles;

-- These views are not needed since we have proper RLS policies on the profiles table
-- Users can query profiles directly with the existing RLS policies that control access:
-- - profiles_owner_full_access: Users can see their own full profile
-- - profiles_admin_verified_access: Verified admins can see other profiles with sensitive data access
-- 
-- For public access to basic profile data, authenticated users can query profiles directly
-- The RLS policies will automatically filter what they can see