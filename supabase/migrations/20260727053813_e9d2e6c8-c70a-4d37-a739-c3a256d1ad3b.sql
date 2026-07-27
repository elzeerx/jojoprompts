REVOKE EXECUTE ON FUNCTION public.cleanup_expired_magic_tokens() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_magic_tokens() TO service_role;