REVOKE EXECUTE ON FUNCTION public.cleanup_expired_sessions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_sessions() TO service_role;