-- Fix security warnings by setting search_path for functions with mutable search_path

-- Fix validate_discount_code function
CREATE OR REPLACE FUNCTION public.validate_discount_code(code_text text, plan_id_param uuid DEFAULT NULL::uuid, user_id_param uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, discount_type text, discount_value numeric, is_valid boolean, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Use the authenticated user if no user_id_param provided
  IF user_id_param IS NULL THEN
    user_id_param := auth.uid();
  END IF;
  
  RETURN QUERY
  SELECT 
    dc.id,
    dc.discount_type,
    dc.discount_value,
    CASE 
      WHEN NOT dc.is_active THEN FALSE
      WHEN dc.expiration_date IS NOT NULL AND dc.expiration_date < now() THEN FALSE
      WHEN dc.usage_limit IS NOT NULL AND dc.times_used >= dc.usage_limit THEN FALSE
      -- Check if user has already used this discount code
      WHEN user_id_param IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.discount_code_usage 
        WHERE discount_code_id = dc.id AND user_id = user_id_param
      ) THEN FALSE
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
      WHEN user_id_param IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.discount_code_usage 
        WHERE discount_code_id = dc.id AND user_id = user_id_param
      ) THEN 'You have already used this discount code'
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

-- Fix record_discount_usage function
CREATE OR REPLACE FUNCTION public.record_discount_usage(
  discount_code_id_param uuid,
  user_id_param uuid DEFAULT NULL,
  payment_history_id_param uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Use the authenticated user if no user_id_param provided
  IF user_id_param IS NULL THEN
    user_id_param := auth.uid();
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

-- Fix other functions that might have mutable search_path

-- Fix is_admin function
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

-- Fix has_role function
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

-- Fix can_manage_prompts function
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

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  generated_username TEXT;
  username_counter INTEGER := 0;
BEGIN
  -- Generate base username from email or name
  generated_username := LOWER(REGEXP_REPLACE(
    COALESCE(
      new.raw_user_meta_data->>'first_name',
      SPLIT_PART(new.raw_user_meta_data->>'full_name', ' ', 1),
      SPLIT_PART(new.email, '@', 1)
    ), '[^a-zA-Z0-9]', '', 'g'
  ));
  
  -- Ensure username is not empty
  IF generated_username = '' THEN
    generated_username := 'user';
  END IF;
  
  -- Make sure username is unique
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = generated_username || CASE WHEN username_counter = 0 THEN '' ELSE username_counter::text END) LOOP
    username_counter := username_counter + 1;
  END LOOP;
  
  IF username_counter > 0 THEN
    generated_username := generated_username || username_counter::text;
  END IF;

  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    username,
    role
  ) VALUES (
    new.id,
    COALESCE(
      new.raw_user_meta_data->>'first_name',
      SPLIT_PART(new.raw_user_meta_data->>'full_name', ' ', 1),
      'User'
    ),
    COALESCE(
      new.raw_user_meta_data->>'last_name',
      SUBSTRING(new.raw_user_meta_data->>'full_name' FROM POSITION(' ' IN new.raw_user_meta_data->>'full_name') + 1),
      ''
    ),
    generated_username,
    CASE 
      WHEN NOT EXISTS (SELECT 1 FROM public.profiles) THEN 'admin'
      ELSE 'user'
    END
  );
  RETURN new;
END;
$function$;

-- Fix ensure_single_active_subscription function
CREATE OR REPLACE FUNCTION public.ensure_single_active_subscription()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- If inserting or updating to active status, cancel other active subscriptions for this user
  IF NEW.status = 'active' THEN
    UPDATE user_subscriptions 
    SET status = 'cancelled', updated_at = now()
    WHERE user_id = NEW.user_id 
      AND status = 'active' 
      AND id != NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix update_categories_updated_at function
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