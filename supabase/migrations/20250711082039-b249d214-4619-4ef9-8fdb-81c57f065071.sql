-- Update validate_discount_code function to check for user usage and prevent duplicate applications
CREATE OR REPLACE FUNCTION public.validate_discount_code(code_text text, plan_id_param uuid DEFAULT NULL, user_id_param uuid DEFAULT NULL)
 RETURNS TABLE(id uuid, discount_type text, discount_value numeric, is_valid boolean, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
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
$function$