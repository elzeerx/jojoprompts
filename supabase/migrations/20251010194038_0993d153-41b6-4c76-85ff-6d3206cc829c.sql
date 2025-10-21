-- Fix security warning: Set search_path for update_platform_updated_at function
CREATE OR REPLACE FUNCTION public.update_platform_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;