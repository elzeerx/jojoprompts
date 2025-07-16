-- Fix security warnings for functions with mutable search paths

-- Update the update_email_engagement_updated_at function with explicit search_path
CREATE OR REPLACE FUNCTION public.update_email_engagement_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public, pg_temp
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Update the confirm_user_email function with explicit search_path  
CREATE OR REPLACE FUNCTION public.confirm_user_email(user_id uuid, email_confirmed boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  -- This function can be used to manually confirm users after they click our custom email
  -- We'll handle this in our custom confirmation flow
  NULL;
END;
$function$;