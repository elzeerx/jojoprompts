
-- Fix search path security warnings for all database functions

-- 1. Update categories updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_categories_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 2. Update create_subscription function
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

-- 3. Update validate_discount_code function
CREATE OR REPLACE FUNCTION public.validate_discount_code(code_text text, plan_id_param uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, discount_type text, discount_value numeric, is_valid boolean, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    dc.id,
    dc.discount_type,
    dc.discount_value,
    CASE 
      WHEN NOT dc.is_active THEN FALSE
      WHEN dc.expiration_date IS NOT NULL AND dc.expiration_date < now() THEN FALSE
      WHEN dc.usage_limit IS NOT NULL AND dc.times_used >= dc.usage_limit THEN FALSE
      WHEN plan_id_param IS NOT NULL AND NOT dc.applies_to_all_plans THEN
        CASE 
          WHEN jsonb_array_length(dc.applicable_plans) = 0 THEN FALSE
          WHEN NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(dc.applicable_plans) AS plan_id
            WHERE plan_id = plan_id_param::text
          ) THEN FALSE
          ELSE TRUE
        END
      ELSE TRUE
    END as is_valid,
    CASE 
      WHEN NOT dc.is_active THEN 'Code is inactive'
      WHEN dc.expiration_date IS NOT NULL AND dc.expiration_date < now() THEN 'Code has expired'
      WHEN dc.usage_limit IS NOT NULL AND dc.times_used >= dc.usage_limit THEN 'Code usage limit reached'
      WHEN plan_id_param IS NOT NULL AND NOT dc.applies_to_all_plans THEN
        CASE 
          WHEN jsonb_array_length(dc.applicable_plans) = 0 THEN 'Code has no applicable plans configured'
          WHEN NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(dc.applicable_plans) AS plan_id
            WHERE plan_id = plan_id_param::text
          ) THEN 'Code is not valid for this plan'
          ELSE 'Valid'
        END
      ELSE 'Valid'
    END as error_message
  FROM public.discount_codes dc
  WHERE dc.code = code_text;
END;
$function$;

-- 4. Update delete_user_account function
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

-- 5. Update has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id AND role = _role
  );
$function$;

-- 6. Update can_manage_prompts function
CREATE OR REPLACE FUNCTION public.can_manage_prompts(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id AND role IN ('admin', 'prompter', 'jadmin')
  );
$function$;

-- 7. Update cancel_user_subscription function
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
  -- Check if the admin has permission (admin role only, not jadmin)
  IF NOT public.has_role(_admin_id, 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient permissions');
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

-- 8. Update is_admin function
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$function$;
