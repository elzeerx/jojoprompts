-- Phase 1: Fix Foreign Key Architecture for User Deletion
-- This migration fixes the FK constraint that prevents user deletion

-- Step 1: Drop the existing FK constraint from security_logs
ALTER TABLE public.security_logs 
DROP CONSTRAINT IF EXISTS security_logs_user_id_fkey;

-- Step 2: Make user_id nullable to support system/anonymous logs
ALTER TABLE public.security_logs 
ALTER COLUMN user_id DROP NOT NULL;

-- Step 3: Create improved admin_delete_user_data function
CREATE OR REPLACE FUNCTION public.admin_delete_user_data(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_counts JSON;
  start_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
  affected_rows INTEGER;
BEGIN
  start_time := NOW();
  
  -- Security check: only admins can delete user data
  IF NOT public.is_admin() THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Admin access required',
      'error_code', 'UNAUTHORIZED'
    );
  END IF;
  
  -- Input validation
  IF target_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'target_user_id cannot be null',
      'error_code', 'INVALID_INPUT'
    );
  END IF;

  -- Verify user exists before attempting deletion
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_user_id) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found',
      'error_code', 'USER_NOT_FOUND'
    );
  END IF;

  BEGIN
    -- IMPORTANT: Preserve security logs for audit trail, just nullify user_id
    UPDATE public.security_logs 
    SET user_id = NULL 
    WHERE user_id = target_user_id;
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    
    RAISE NOTICE 'Preserved % security log entries', affected_rows;
    
    -- Delete email logs (can be removed as they're not critical for audit)
    DELETE FROM public.email_logs WHERE user_id = target_user_id;
    
    -- Delete admin audit logs WHERE USER IS THE ACTOR (not the target)
    DELETE FROM public.admin_audit_log WHERE admin_user_id = target_user_id;
    
    -- Delete collection-related data
    DELETE FROM public.collection_prompts 
    WHERE collection_id IN (
      SELECT id FROM public.collections WHERE user_id = target_user_id
    );
    DELETE FROM public.collections WHERE user_id = target_user_id;
    
    -- Delete user activity data
    DELETE FROM public.prompt_shares WHERE shared_by = target_user_id;
    DELETE FROM public.prompt_usage_history WHERE user_id = target_user_id;
    DELETE FROM public.user_subscriptions WHERE user_id = target_user_id;
    DELETE FROM public.transactions WHERE user_id = target_user_id;
    DELETE FROM public.favorites WHERE user_id = target_user_id;
    DELETE FROM public.prompts WHERE user_id = target_user_id;
    DELETE FROM public.discount_code_usage WHERE user_id = target_user_id;
    
    -- Delete user-created admin data
    DELETE FROM public.prompt_generator_templates WHERE created_by = target_user_id;
    DELETE FROM public.prompt_generator_fields WHERE created_by = target_user_id;
    DELETE FROM public.prompt_generator_models WHERE created_by = target_user_id;
    DELETE FROM public.discount_codes WHERE created_by = target_user_id;
    
    -- Delete profile last
    DELETE FROM public.profiles WHERE id = target_user_id;

    end_time := NOW();
    
    RETURN json_build_object(
      'success', true,
      'message', 'User data deleted successfully',
      'duration_ms', EXTRACT(EPOCH FROM (end_time - start_time)) * 1000,
      'deleted_user_id', target_user_id,
      'security_logs_preserved', affected_rows
    );
    
  EXCEPTION 
    WHEN foreign_key_violation THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Foreign key constraint violation: ' || SQLERRM,
        'error_code', 'FK_VIOLATION',
        'error_detail', SQLSTATE
      );
    WHEN OTHERS THEN
      RETURN json_build_object(
        'success', false,
        'error', SQLERRM,
        'error_code', 'DATABASE_ERROR',
        'error_detail', SQLSTATE
      );
  END;
END;
$$;

-- Step 4: Create cleanup function for old orphaned security logs (optional)
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_security_logs(days_old INTEGER DEFAULT 90)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Only admins can run cleanup
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  DELETE FROM public.security_logs 
  WHERE user_id IS NULL 
    AND created_at < NOW() - (days_old || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN json_build_object(
    'success', true,
    'deleted_count', deleted_count,
    'message', format('Cleaned up %s orphaned security logs older than %s days', deleted_count, days_old)
  );
END;
$$;

-- Add helpful comment
COMMENT ON FUNCTION public.admin_delete_user_data IS 
'Deletes all user data while preserving security logs for audit trail. Only callable by admins.';

COMMENT ON FUNCTION public.cleanup_orphaned_security_logs IS 
'Removes old security logs with NULL user_id (from deleted users). Only callable by admins.';