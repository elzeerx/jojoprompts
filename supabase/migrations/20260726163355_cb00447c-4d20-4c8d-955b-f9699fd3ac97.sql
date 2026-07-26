-- Idempotent sync of already-applied production hardening for public.admin_access_tokens.
-- Safe to re-run: drops named policies if present, revokes anon, recreates the intended SELECT policy.

REVOKE ALL ON public.admin_access_tokens FROM anon;

DROP POLICY IF EXISTS "Service role can manage access tokens" ON public.admin_access_tokens;
DROP POLICY IF EXISTS "Token owner and service role can access" ON public.admin_access_tokens;
DROP POLICY IF EXISTS "Token owner can access" ON public.admin_access_tokens;

ALTER TABLE public.admin_access_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Token owner can access"
  ON public.admin_access_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = admin_user_id);
