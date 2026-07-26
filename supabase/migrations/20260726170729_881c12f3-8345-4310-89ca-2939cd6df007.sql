REVOKE EXECUTE ON FUNCTION public.cleanup_security_data() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_unverified_accounts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_security_data() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_unverified_accounts() TO service_role;