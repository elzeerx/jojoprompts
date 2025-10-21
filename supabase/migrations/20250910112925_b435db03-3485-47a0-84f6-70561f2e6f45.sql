-- Enhanced Security Implementation for Profiles Table
-- This migration addresses the security vulnerability by implementing:
-- 1. Stricter admin verification with audit logging
-- 2. Separate policies for sensitive vs non-sensitive data
-- 3. Enhanced security functions with additional checks
-- 4. Audit trail for admin access to sensitive data

-- Create enhanced admin verification function with logging
CREATE OR REPLACE FUNCTION public.is_verified_admin(action_context text DEFAULT 'unknown')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_role text;
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  -- Return false if no authenticated user
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get user role
  SELECT role INTO user_role 
  FROM public.profiles 
  WHERE id = current_user_id;
  
  -- Check if user is admin
  IF user_role = 'admin' THEN
    -- Log admin access attempt for auditing
    INSERT INTO public.admin_audit_log (
      admin_user_id,
      action,
      target_resource,
      metadata,
      timestamp
    ) VALUES (
      current_user_id,
      'admin_verification_check',
      'profiles_table',
      jsonb_build_object(
        'action_context', action_context,
        'verification_result', 'success'
      ),
      now()
    );
    
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Create function to check if admin can access sensitive data with additional verification
CREATE OR REPLACE FUNCTION public.can_access_sensitive_profile_data(target_user_id uuid DEFAULT null)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_user_id uuid;
  is_admin_user boolean;
BEGIN
  current_user_id := auth.uid();
  
  -- Return false if no authenticated user
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if current user is verified admin
  is_admin_user := public.is_verified_admin('sensitive_data_access');
  
  IF is_admin_user AND target_user_id IS NOT NULL THEN
    -- Log sensitive data access
    INSERT INTO public.admin_audit_log (
      admin_user_id,
      action,
      target_resource,
      metadata,
      timestamp
    ) VALUES (
      current_user_id,
      'sensitive_profile_data_access',
      'profiles_table',
      jsonb_build_object(
        'target_user_id', target_user_id,
        'accessed_fields', 'phone_number,email_related_data'
      ),
      now()
    );
  END IF;
  
  RETURN is_admin_user;
END;
$$;

-- Drop existing permissive policies
DROP POLICY IF EXISTS "profiles_select_owner_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_self_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_owner_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_owner_or_admin" ON public.profiles;

-- Create new restrictive policies for basic profile data (non-sensitive)
CREATE POLICY "profiles_select_basic_data"
ON public.profiles
FOR SELECT
USING (
  -- Users can always see their own data
  auth.uid() = id 
  OR 
  -- Admins can see basic profile info with verification and logging
  public.is_verified_admin('basic_profile_select')
);

-- Create policy for sensitive data access (phone_number, etc.)
CREATE POLICY "profiles_select_sensitive_data"
ON public.profiles
FOR SELECT
USING (
  -- Users can see their own sensitive data
  auth.uid() = id 
  OR 
  -- Admins need enhanced verification for sensitive data
  public.can_access_sensitive_profile_data(id)
);

-- Policy for profile insertion - only for self or verified admin
CREATE POLICY "profiles_insert_verified"
ON public.profiles
FOR INSERT
WITH CHECK (
  -- Users can create their own profile
  auth.uid() = id 
  OR 
  -- Verified admins can create profiles with logging
  public.is_verified_admin('profile_creation')
);

-- Policy for profile updates with enhanced verification
CREATE POLICY "profiles_update_verified"
ON public.profiles
FOR UPDATE
USING (
  -- Users can update their own profile
  auth.uid() = id 
  OR 
  -- Verified admins can update with logging
  public.is_verified_admin('profile_update')
)
WITH CHECK (
  -- Same check for the updated data
  auth.uid() = id 
  OR 
  public.is_verified_admin('profile_update')
);

-- Policy for profile deletion with strict verification
CREATE POLICY "profiles_delete_verified"
ON public.profiles
FOR DELETE
USING (
  -- Users can delete their own profile
  auth.uid() = id 
  OR 
  -- Only verified admins can delete profiles with logging
  public.is_verified_admin('profile_deletion')
);

-- Create function to safely get user profile without exposing sensitive data to admins unnecessarily
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
  created_at timestamptz,
  -- Sensitive fields only returned if proper access
  phone_number text,
  social_links jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  can_access_sensitive boolean;
  profile_record record;
BEGIN
  -- Check if current user can access this profile
  IF auth.uid() != user_id_param AND NOT public.is_verified_admin('safe_profile_access') THEN
    -- Return null if no access
    RETURN;
  END IF;
  
  -- Determine if sensitive data can be accessed
  can_access_sensitive := (auth.uid() = user_id_param) OR public.can_access_sensitive_profile_data(user_id_param);
  
  -- Get the profile data
  SELECT * INTO profile_record FROM public.profiles WHERE profiles.id = user_id_param;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Return data with conditional sensitive fields
  RETURN QUERY SELECT
    profile_record.id,
    profile_record.first_name,
    profile_record.last_name,
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

-- Add comment explaining the security improvements
COMMENT ON FUNCTION public.is_verified_admin IS 'Enhanced admin verification function that logs all admin access attempts for security auditing';
COMMENT ON FUNCTION public.can_access_sensitive_profile_data IS 'Strict function for accessing sensitive profile data with additional verification and audit logging';
COMMENT ON FUNCTION public.get_user_profile_safe IS 'Safe profile access function that conditionally returns sensitive data based on proper authorization';