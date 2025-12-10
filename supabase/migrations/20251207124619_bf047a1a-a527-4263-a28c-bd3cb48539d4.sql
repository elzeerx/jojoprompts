-- Allow anonymous users to view prompts (displayed as locked in UI)
CREATE POLICY "Anonymous users can view prompts" 
ON public.prompts
FOR SELECT
TO anon
USING (true);

-- Grant execute on helper functions for anon users
GRANT EXECUTE ON FUNCTION public.get_user_subscription_tier(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.can_access_tier(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.can_access_prompt(UUID, UUID) TO anon;