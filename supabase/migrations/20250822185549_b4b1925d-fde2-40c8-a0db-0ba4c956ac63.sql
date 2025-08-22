-- Security Fix 1: Prevent role escalation on profiles table
-- Drop existing permissive UPDATE policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create new UPDATE policy that prevents role changes unless user already has that role
CREATE POLICY "Users can update their own profile (no role change)" ON public.profiles
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id AND has_role(auth.uid(), role));

-- Add defense-in-depth trigger to block non-admin role changes
CREATE OR REPLACE FUNCTION public.prevent_role_change()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Insufficient permissions to change role';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_change ON public.profiles;
CREATE TRIGGER trg_prevent_role_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_role_change();

-- Security Fix 2: Lock down email_magic_tokens (should not be client-accessible)
DROP POLICY IF EXISTS "System can manage magic tokens" ON public.email_magic_tokens;

-- Add admin-only SELECT policy for troubleshooting
CREATE POLICY "Admins can view magic tokens" ON public.email_magic_tokens
FOR SELECT USING (public.is_admin());

-- Security Fix 3: Fix delete_user_account function authorization
CREATE OR REPLACE FUNCTION public.delete_user_account(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _subscription_record record;
  _result json;
BEGIN
  -- Security check: only allow users to delete their own account
  IF _user_id IS DISTINCT FROM auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- First, cancel any active subscriptions
  SELECT * INTO _subscription_record
  FROM public.user_subscriptions
  WHERE user_id = _user_id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.user_subscriptions
    SET status = 'cancelled', updated_at = now()
    WHERE id = _subscription_record.id;
  END IF;

  -- Delete user data in correct order to avoid FK constraint errors
  -- Delete collection_prompts first
  DELETE FROM public.collection_prompts 
  WHERE collection_id IN (SELECT id FROM public.collections WHERE user_id = _user_id);
  
  -- Delete collections
  DELETE FROM public.collections WHERE user_id = _user_id;
  
  -- Delete prompt shares
  DELETE FROM public.prompt_shares WHERE shared_by = _user_id;
  
  -- Delete prompt usage history
  DELETE FROM public.prompt_usage_history WHERE user_id = _user_id;
  
  -- Delete user subscriptions
  DELETE FROM public.user_subscriptions WHERE user_id = _user_id;
  
  -- Delete transactions
  DELETE FROM public.transactions WHERE user_id = _user_id;
  
  -- Delete favorites
  DELETE FROM public.favorites WHERE user_id = _user_id;
  
  -- Delete prompts created by user
  DELETE FROM public.prompts WHERE user_id = _user_id;
  
  -- Delete discount code usage
  DELETE FROM public.discount_code_usage WHERE user_id = _user_id;
  
  -- Delete profile
  DELETE FROM public.profiles WHERE id = _user_id;

  -- Return success
  RETURN json_build_object(
    'success', true, 
    'message', 'Account deleted successfully',
    'subscription_cancelled', FOUND
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false, 
      'error', SQLERRM
    );
END;
$function$;

-- Security Fix 4: Fix admin_delete_user_data function authorization  
CREATE OR REPLACE FUNCTION public.admin_delete_user_data(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  deleted_counts JSON;
  start_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
BEGIN
  start_time := NOW();
  
  -- Security check: only admins can delete user data
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;
  
  -- Input validation
  IF target_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'target_user_id cannot be null'
    );
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
$function$;

-- Security Fix 5: Fix create_subscription function authorization
CREATE OR REPLACE FUNCTION public.create_subscription(p_user_id uuid, p_plan_id uuid, p_paypal_payment_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result json;
  existing_subscription RECORD;
BEGIN
  -- Security check: only allow users to create subscriptions for themselves
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- Check if subscription already exists for this PayPal payment
  SELECT * INTO existing_subscription FROM public.user_subscriptions
    WHERE payment_method = 'paypal' AND payment_id = p_paypal_payment_id;

  IF FOUND THEN
    RETURN json_build_object('success', true, 'message', 'Subscription already exists for this PayPal payment');
  END IF;

  -- Insert new subscription
  INSERT INTO public.user_subscriptions (
    user_id, plan_id, payment_method, payment_id, status, start_date
  )
  VALUES
    (p_user_id, p_plan_id, 'paypal', p_paypal_payment_id, 'active', now());

  RETURN json_build_object('success', true, 'message', 'Subscription created successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- Security Fix 6: Fix cancel_user_subscription function authorization
CREATE OR REPLACE FUNCTION public.cancel_user_subscription(_user_id uuid, _admin_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _subscription_record record;
  _result json;
BEGIN
  -- Security check: must be admin and caller must match admin_id
  IF NOT public.is_admin() OR _admin_id IS DISTINCT FROM auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  -- Get active subscription
  SELECT * INTO _subscription_record
  FROM public.user_subscriptions
  WHERE user_id = _user_id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'No active subscription found');
  END IF;

  -- Update subscription status to cancelled
  UPDATE public.user_subscriptions
  SET status = 'cancelled', updated_at = now()
  WHERE id = _subscription_record.id;

  -- Return success
  RETURN json_build_object('success', true, 'message', 'Subscription cancelled successfully');
END;
$function$;

-- Security Fix 7: Fix record_discount_usage function authorization
CREATE OR REPLACE FUNCTION public.record_discount_usage(discount_code_id_param uuid, user_id_param uuid DEFAULT NULL::uuid, payment_history_id_param uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Security fix: force binding to authenticated user, no override allowed
  user_id_param := auth.uid();
  IF user_id_param IS NULL THEN 
    RETURN FALSE; 
  END IF;
  
  -- Check if user already used this discount
  IF EXISTS (
    SELECT 1 FROM public.discount_code_usage 
    WHERE discount_code_id = discount_code_id_param AND user_id = user_id_param
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Record the usage
  INSERT INTO public.discount_code_usage (
    discount_code_id,
    user_id,
    payment_history_id,
    used_at
  ) VALUES (
    discount_code_id_param,
    user_id_param,
    payment_history_id_param,
    now()
  );
  
  -- Increment the times_used counter
  UPDATE public.discount_codes 
  SET times_used = times_used + 1, updated_at = now()
  WHERE id = discount_code_id_param;
  
  RETURN TRUE;
END;
$function$;

-- Security Fix 8: Restrict unsubscribed_emails updates
DROP POLICY IF EXISTS "Anyone can update unsubscribe records" ON public.unsubscribed_emails;

-- Add admin-only UPDATE policy
CREATE POLICY "Admins can update unsubscribe records" ON public.unsubscribed_emails
FOR UPDATE USING (public.is_admin());