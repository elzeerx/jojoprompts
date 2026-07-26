ALTER POLICY "Admins can view audit logs"
  ON public.admin_audit_log
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));