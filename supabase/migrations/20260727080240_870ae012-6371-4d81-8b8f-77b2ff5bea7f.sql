CREATE OR REPLACE FUNCTION public.is_verified_admin(action_context text DEFAULT 'unknown'::text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT public.is_admin();
$function$;

DROP POLICY IF EXISTS "Verified admins can view all security logs" ON public.security_logs;

CREATE POLICY "Admins can view all security logs"
  ON public.security_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin());
