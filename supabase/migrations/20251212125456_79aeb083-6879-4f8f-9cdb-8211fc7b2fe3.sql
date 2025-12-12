-- Fix: Remove SECURITY DEFINER view (security warning) and use a simpler approach
-- The RLS policies already control access, we just need to update the service to use the secure view

-- Drop the security definer view
DROP VIEW IF EXISTS public.prompts_secure;

-- Instead, we'll mask content in the service layer and rely on RLS for access control
-- The user_has_active_subscription function is still useful for other checks

-- Add a comment to document the security model
COMMENT ON TABLE public.prompts IS 'Prompts table with RLS policies. IMPORTANT: prompt_text should only be exposed to users with active subscriptions. Use prompts_secure view or check subscription in application code.';