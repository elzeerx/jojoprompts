-- Create function to record discount usage and increment counter
CREATE OR REPLACE FUNCTION public.record_discount_usage(
  discount_code_id_param uuid,
  user_id_param uuid DEFAULT NULL,
  payment_history_id_param uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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
$function$