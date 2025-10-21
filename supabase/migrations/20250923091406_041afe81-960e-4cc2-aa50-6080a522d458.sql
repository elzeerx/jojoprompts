-- Security Fix: Restrict Profile Access to Prevent Data Theft
-- Issue: Current RLS policies may allow broader access to personal information

-- First, drop the existing overly permissive policies
DROP POLICY IF EXISTS "profiles_select_basic_data" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_sensitive_data" ON public.profiles;

-- Create more restrictive policies that separate public profile info from private data
-- Policy 1: Public profile information (username, role, avatar, bio) - minimal exposure
CREATE POLICY "profiles_select_public_info" 
ON public.profiles 
FOR SELECT 
USING (
  -- Users can see their own full profile
  auth.uid() = id OR 
  -- Others can only see public fields (handled at application level)
  -- Verified admins can access with logging
  is_verified_admin('public_profile_access'::text)
);

-- Policy 2: Private profile information (names, phone, social_links, etc.)
CREATE POLICY "profiles_select_private_info" 
ON public.profiles 
FOR SELECT 
USING (
  -- Only profile owner can see their private data
  auth.uid() = id OR 
  -- Verified admins with specific sensitive data permission and logging
  can_access_sensitive_profile_data(id)
);

-- Enhanced function to safely return only public profile fields to non-owners
CREATE OR REPLACE FUNCTION public.get_public_profile_safe(user_id_param uuid)
RETURNS TABLE(
  id uuid, 
  username text, 
  role text, 
  avatar_url text, 
  bio text, 
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only return minimal public profile information
  RETURN QUERY SELECT
    profiles.id,
    profiles.username,
    profiles.role,
    profiles.avatar_url,
    profiles.bio,
    profiles.created_at
  FROM public.profiles 
  WHERE profiles.id = user_id_param;
END;
$$;

-- Enhanced audit logging for profile access attempts
CREATE OR REPLACE FUNCTION public.log_profile_access_attempt(
  target_user_id uuid,
  access_type text,
  granted boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log all profile access attempts for security monitoring
  INSERT INTO public.admin_audit_log (
    admin_user_id,
    action,
    target_resource,
    metadata,
    timestamp
  ) VALUES (
    auth.uid(),
    'profile_access_attempt',
    'profiles_table',
    jsonb_build_object(
      'target_user_id', target_user_id,
      'access_type', access_type,
      'access_granted', granted,
      'ip_address', current_setting('request.headers', true)::json->>'x-forwarded-for'
    ),
    now()
  );
END;
$$;

-- Create a secure view for public profile data that automatically restricts fields
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  username,
  role,
  avatar_url,
  bio,
  created_at
FROM public.profiles
WHERE 
  -- Users can see their own profile fully via direct table access
  -- This view is for public/limited access scenarios
  id != COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);

-- Grant access to the public profiles view
GRANT SELECT ON public.public_profiles TO authenticated;

-- Add RLS to the view as well
ALTER VIEW public.public_profiles SET (security_barrier = true);

-- Update the existing secure profile access function to be more restrictive
CREATE OR REPLACE FUNCTION public.get_user_profile_safe(user_id_param uuid)
RETURNS TABLE(
  id uuid, 
  first_name text, 
  last_name text, 
  username text, 
  role text, 
  avatar_url text, 
  bio text, 
  country text, 
  membership_tier text, 
  created_at timestamp with time zone, 
  phone_number text, 
  social_links jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  can_access_sensitive boolean;
  profile_record record;
  is_owner boolean;
BEGIN
  -- Check if requesting user is the profile owner
  is_owner := auth.uid() = user_id_param;
  
  -- For non-owners, check if they have verified admin access
  IF NOT is_owner THEN
    IF NOT is_verified_admin('safe_profile_access') THEN
      -- Log unauthorized access attempt
      PERFORM log_profile_access_attempt(user_id_param, 'unauthorized_access', false);
      RETURN;
    END IF;
  END IF;
  
  -- Determine if sensitive data can be accessed
  can_access_sensitive := is_owner OR can_access_sensitive_profile_data(user_id_param);
  
  -- Log access attempt for auditing
  PERFORM log_profile_access_attempt(
    user_id_param, 
    CASE WHEN is_owner THEN 'owner_access' ELSE 'admin_access' END,
    true
  );
  
  -- Get the profile data
  SELECT * INTO profile_record FROM public.profiles WHERE profiles.id = user_id_param;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Return data with conditional sensitive fields
  RETURN QUERY SELECT
    profile_record.id,
    CASE WHEN can_access_sensitive THEN profile_record.first_name ELSE '***' END,
    CASE WHEN can_access_sensitive THEN profile_record.last_name ELSE '***' END,
    profile_record.username,
    profile_record.role,
    profile_record.avatar_url,
    profile_record.bio,
    profile_record.country,
    profile_record.membership_tier,
    profile_record.created_at,
    CASE WHEN can_access_sensitive THEN profile_record.phone_number ELSE NULL END,
    CASE WHEN can_access_sensitive THEN profile_record.social_links ELSE '{}'::jsonb END;
END;
$$;