-- Fix function search path security warnings
ALTER FUNCTION public.secure_admin_audit_insert() SET search_path = public;
ALTER FUNCTION public.secure_security_log_insert() SET search_path = public;