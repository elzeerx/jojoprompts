-- First, let's create a more powerful deletion function that bypasses RLS
CREATE OR REPLACE FUNCTION public.admin_delete_user_data(target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_counts JSON;
  start_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
BEGIN
  start_time := NOW();
  
  -- Only allow admins to execute this function
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

  -- Delete all user data in correct order to avoid FK violations
  -- Using SECURITY DEFINER bypasses RLS policies
  
  -- 1. Delete audit/logging tables first
  DELETE FROM public.security_logs WHERE user_id = target_user_id;
  DELETE FROM public.email_logs WHERE user_id = target_user_id;
  DELETE FROM public.admin_audit_log WHERE admin_user_id = target_user_id;
  
  -- 2. Delete collection-related data
  DELETE FROM public.collection_prompts 
  WHERE collection_id IN (
    SELECT id FROM public.collections WHERE user_id = target_user_id
  );
  DELETE FROM public.collections WHERE user_id = target_user_id;
  
  -- 3. Delete user activity data
  DELETE FROM public.prompt_shares WHERE shared_by = target_user_id;
  DELETE FROM public.prompt_usage_history WHERE user_id = target_user_id;
  DELETE FROM public.user_subscriptions WHERE user_id = target_user_id;
  DELETE FROM public.transactions WHERE user_id = target_user_id;
  DELETE FROM public.favorites WHERE user_id = target_user_id;
  DELETE FROM public.prompts WHERE user_id = target_user_id;
  DELETE FROM public.discount_code_usage WHERE user_id = target_user_id;
  
  -- 4. Delete user-created admin data
  DELETE FROM public.prompt_generator_templates WHERE created_by = target_user_id;
  DELETE FROM public.prompt_generator_fields WHERE created_by = target_user_id;
  DELETE FROM public.prompt_generator_models WHERE created_by = target_user_id;
  DELETE FROM public.discount_codes WHERE created_by = target_user_id;
  
  -- 5. Delete profile
  DELETE FROM public.profiles WHERE id = target_user_id;

  end_time := NOW();
  
  RETURN json_build_object(
    'success', true,
    'message', 'User data deleted successfully',
    'duration_ms', EXTRACT(EPOCH FROM (end_time - start_time)) * 1000,
    'deleted_user_id', target_user_id
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM,
    'error_detail', SQLSTATE
  );
END;
$$;