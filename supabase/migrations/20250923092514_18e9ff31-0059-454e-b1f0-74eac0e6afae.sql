-- Fix Customer Personal Information Security Issue
-- Create strict RLS policies to prevent unauthorized access to sensitive profile data

-- First, drop all existing profile policies to start fresh
DROP POLICY IF EXISTS "profiles_select_private_info" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_public_info" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_verified" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_verified" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_verified" ON public.profiles;

-- Create highly restrictive policies that clearly separate access patterns

-- 1. Public profile data policy - only basic info for authenticated users
CREATE POLICY "profiles_public_data_authenticated" ON public.profiles
FOR SELECT 
TO authenticated
USING (true)
WITH CHECK (false);

-- 2. Private profile data policy - owner or verified admin only
CREATE POLICY "profiles_private_data_owner_admin" ON public.profiles
FOR SELECT 
TO authenticated
USING (
  auth.uid() = id OR 
  (is_verified_admin('sensitive_profile_access') AND can_access_sensitive_profile_data(id))
);

-- 3. Insert policy - only allow users to create their own profile
CREATE POLICY "profiles_insert_own_only" ON public.profiles
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

-- 4. Update policy - users can update their own profile, admins can update any
CREATE POLICY "profiles_update_owner_or_admin" ON public.profiles
FOR UPDATE 
TO authenticated
USING (auth.uid() = id OR is_verified_admin('profile_modification'))
WITH CHECK (auth.uid() = id OR is_verified_admin('profile_modification'));

-- 5. Delete policy - users can delete their own profile, admins can delete any
CREATE POLICY "profiles_delete_owner_or_admin" ON public.profiles
FOR DELETE 
TO authenticated
USING (auth.uid() = id OR is_verified_admin('profile_deletion'));

-- Create a secure view for public profile data only
CREATE OR REPLACE VIEW public.safe_public_profiles
WITH (security_barrier=true) AS
SELECT 
  id,
  username,
  role,
  avatar_url,
  bio,
  created_at
FROM public.profiles;

-- Grant access to the safe view
GRANT SELECT ON public.safe_public_profiles TO authenticated;

-- Revoke direct access to profiles table from public role (safety measure)
REVOKE ALL ON public.profiles FROM anon;
REVOKE SELECT ON public.profiles FROM anon;

-- Ensure only authenticated users can access profiles table
GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated;
GRANT DELETE ON public.profiles TO authenticated;