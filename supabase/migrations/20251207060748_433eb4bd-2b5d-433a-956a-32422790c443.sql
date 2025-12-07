-- Remove the confusing "Block anonymous access to profiles" policy
-- This policy uses USING (false) which is redundant since other policies 
-- already properly restrict access to authenticated users only

DROP POLICY IF EXISTS "Block anonymous access to profiles" ON public.profiles;

-- Add a comment explaining the security model
COMMENT ON TABLE public.profiles IS 'User profiles with RLS policies: owners can view/update/delete own profile, admins can view/update/delete all profiles. Anonymous access is blocked by requiring auth.uid() in all policies.';