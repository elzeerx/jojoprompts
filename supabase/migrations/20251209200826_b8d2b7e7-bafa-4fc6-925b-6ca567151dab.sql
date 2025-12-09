-- Fix ambiguous column reference in admin_delete_user_data
-- The function parameter 'admin_user_id' conflicts with the column name in admin_audit_log

CREATE OR REPLACE FUNCTION public.admin_delete_user_data(target_user_id uuid, admin_user_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  deleted_counts JSON;
  start_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
  affected_rows INTEGER;
BEGIN
  start_time := NOW();
  
  -- Security check: verify admin_user_id is actually an admin
  -- Use has_role() instead of is_admin() since edge functions call with service role
  IF admin_user_id IS NULL OR NOT public.has_role(admin_user_id, 'admin') THEN
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
    -- Use table alias 'aal' to disambiguate from function parameter 'admin_user_id'
    DELETE FROM public.admin_audit_log aal WHERE aal.admin_user_id = target_user_id;
    
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
    
    -- Delete user roles
    DELETE FROM public.user_roles WHERE user_id = target_user_id;
    
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
$function$;