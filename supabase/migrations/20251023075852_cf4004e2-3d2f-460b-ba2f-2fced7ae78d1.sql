-- =====================================================
-- FIX SECURITY LINTER WARNINGS
-- Addresses the 3 linter issues from previous migration
-- =====================================================

-- 1. FIX: Remove Security Definer View
-- Drop the profiles_public view as it's not needed with proper RLS
DROP VIEW IF EXISTS public.profiles_public;

-- 2. FIX: Add search_path to cleanup_old_logs function
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Cleanup email logs older than 90 days
  DELETE FROM public.email_logs 
  WHERE attempted_at < NOW() - INTERVAL '90 days';
  
  -- Cleanup API request logs older than 30 days
  DELETE FROM public.api_request_logs 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- Cleanup security logs older than 180 days
  DELETE FROM public.security_logs 
  WHERE created_at < NOW() - INTERVAL '180 days';
END;
$$;

-- 3. VERIFY: log_sensitive_data_access already has search_path set
-- This was done correctly in the previous migration, no action needed

-- =====================================================
-- ALL LINTER WARNINGS RESOLVED:
-- 1. ✅ Removed security definer view
-- 2. ✅ Added search_path to cleanup function
-- 3. ✅ log_sensitive_data_access already secure
-- =====================================================