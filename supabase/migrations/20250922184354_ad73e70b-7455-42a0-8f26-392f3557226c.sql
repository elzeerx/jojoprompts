-- Fix function search path security issue
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark sessions as invalid if inactive for more than 24 hours
  UPDATE public.session_integrity 
  SET is_valid = false 
  WHERE last_activity < now() - interval '24 hours' AND is_valid = true;
  
  -- Delete old invalid sessions (older than 7 days)
  DELETE FROM public.session_integrity 
  WHERE created_at < now() - interval '7 days' AND is_valid = false;
END;
$$;