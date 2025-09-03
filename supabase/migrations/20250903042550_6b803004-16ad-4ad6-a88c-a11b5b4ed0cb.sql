-- Fix the prevent_role_change function to have proper search_path
CREATE OR REPLACE FUNCTION public.prevent_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Insufficient permissions to change role';
  END IF;
  RETURN NEW;
END;
$$;