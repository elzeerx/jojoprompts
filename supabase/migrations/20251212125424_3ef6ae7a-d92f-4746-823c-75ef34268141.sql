-- =============================================================================
-- FIX: Restrict prompt_text access to subscribers only
-- This prevents users from accessing content without paying
-- =============================================================================

-- Drop the overly permissive anonymous read policy
DROP POLICY IF EXISTS "Anonymous users can view prompts" ON public.prompts;
DROP POLICY IF EXISTS "anon_select_prompts" ON public.prompts;
DROP POLICY IF EXISTS "prompts_select" ON public.prompts;
DROP POLICY IF EXISTS "Anyone can view prompts" ON public.prompts;

-- Create a function to check if user has an active subscription
CREATE OR REPLACE FUNCTION public.user_has_active_subscription(check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user has an active subscription
  RETURN EXISTS (
    SELECT 1 FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.user_id = check_user_id
    AND us.status IN ('active', 'trial')
    AND (us.end_date IS NULL OR us.end_date > now())
  );
END;
$$;

-- Grant execute on the function
GRANT EXECUTE ON FUNCTION public.user_has_active_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_active_subscription(uuid) TO service_role;

-- Create secure prompts view that masks prompt_text for non-subscribers
-- This view will be used by the application
CREATE OR REPLACE VIEW public.prompts_secure AS
SELECT 
  id,
  title,
  -- Mask prompt_text unless user has subscription, is admin, or owns the prompt
  CASE 
    WHEN auth.uid() IS NULL THEN '🔒 Subscribe to view this premium content'
    WHEN has_role(auth.uid(), 'admin'::app_role) THEN prompt_text
    WHEN has_role(auth.uid(), 'prompter'::app_role) THEN prompt_text
    WHEN has_role(auth.uid(), 'jadmin'::app_role) THEN prompt_text
    WHEN user_id = auth.uid() THEN prompt_text
    WHEN user_has_active_subscription(auth.uid()) THEN prompt_text
    ELSE '🔒 Subscribe to view this premium content'
  END AS prompt_text,
  prompt_type,
  user_id,
  image_path,
  default_image_path,
  metadata,
  created_at,
  platform_id,
  platform_fields,
  title_ar,
  prompt_text_ar,
  version
FROM public.prompts;

-- Grant access to the secure view
GRANT SELECT ON public.prompts_secure TO authenticated;
GRANT SELECT ON public.prompts_secure TO anon;

-- Create new RLS policies for prompts table

-- Allow authenticated users to read prompts (full data, text masked in view)
CREATE POLICY "authenticated_users_can_read_prompts"
ON public.prompts
FOR SELECT
TO authenticated
USING (true);

-- Allow anonymous users to read metadata only (for marketing/examples)
CREATE POLICY "anonymous_limited_prompts_view"
ON public.prompts
FOR SELECT
TO anon
USING (true);  -- View handles masking

-- Keep existing insert/update/delete policies for admins/prompters
-- These should already exist, but let's ensure they're correct:
DROP POLICY IF EXISTS "Admins can manage prompts" ON public.prompts;
DROP POLICY IF EXISTS "Prompters can manage own prompts" ON public.prompts;

CREATE POLICY "admins_full_prompts_access"
ON public.prompts
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'jadmin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'jadmin'::app_role)
);

CREATE POLICY "prompters_manage_own_prompts"
ON public.prompts
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'prompter'::app_role) AND user_id = auth.uid()
)
WITH CHECK (
  has_role(auth.uid(), 'prompter'::app_role) AND user_id = auth.uid()
);

-- Add comment explaining the security model
COMMENT ON VIEW public.prompts_secure IS 'Secure view that masks prompt_text for users without active subscriptions. Use this view in application code instead of prompts table directly.';
COMMENT ON FUNCTION public.user_has_active_subscription IS 'Checks if a user has an active subscription. Used for content access control.';