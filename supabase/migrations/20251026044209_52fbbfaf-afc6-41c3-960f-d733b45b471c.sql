-- Fix client-side subscription bypass - Implement server-side RLS for premium content protection
-- This migration adds subscription tier enforcement at the database level

-- Step 1: Add tier column to subscription_plans for clear hierarchy
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS tier TEXT;

-- Update tier values based on plan names
UPDATE public.subscription_plans SET tier = 'basic' WHERE name = 'Basic';
UPDATE public.subscription_plans SET tier = 'standard' WHERE name = 'Standard';
UPDATE public.subscription_plans SET tier = 'premium' WHERE name = 'Premium';
UPDATE public.subscription_plans SET tier = 'ultimate' WHERE name = 'Ultimate';

-- Add constraint to ensure tier is set for all plans
ALTER TABLE public.subscription_plans 
ALTER COLUMN tier SET NOT NULL;

-- Step 2: Create function to get user's subscription tier
CREATE OR REPLACE FUNCTION public.get_user_subscription_tier(user_id_param UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_tier TEXT;
BEGIN
  -- Get the highest tier from active subscriptions
  SELECT sp.tier INTO user_tier
  FROM user_subscriptions us
  JOIN subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = user_id_param
    AND us.status = 'active'
    AND (us.end_date IS NULL OR us.end_date > NOW())
  ORDER BY 
    CASE sp.tier
      WHEN 'ultimate' THEN 4
      WHEN 'premium' THEN 3
      WHEN 'standard' THEN 2
      WHEN 'basic' THEN 1
      ELSE 0
    END DESC
  LIMIT 1;
  
  RETURN COALESCE(user_tier, 'free');
END;
$$;

-- Step 3: Create function to check if user can access content with required tier
CREATE OR REPLACE FUNCTION public.can_access_tier(user_id_param UUID, required_tier TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_tier TEXT;
  user_tier_level INTEGER;
  required_tier_level INTEGER;
BEGIN
  -- Admins can access everything
  IF has_role(user_id_param, 'admin'::app_role) OR 
     has_role(user_id_param, 'jadmin'::app_role) OR 
     has_role(user_id_param, 'prompter'::app_role) THEN
    RETURN TRUE;
  END IF;
  
  -- Get user's subscription tier
  user_tier := get_user_subscription_tier(user_id_param);
  
  -- Convert tiers to numeric levels for comparison
  user_tier_level := CASE user_tier
    WHEN 'ultimate' THEN 4
    WHEN 'premium' THEN 3
    WHEN 'standard' THEN 2
    WHEN 'basic' THEN 1
    ELSE 0  -- free tier
  END;
  
  required_tier_level := CASE COALESCE(required_tier, 'basic')
    WHEN 'premium' THEN 3
    WHEN 'standard' THEN 2
    WHEN 'basic' THEN 1
    ELSE 1  -- default to basic
  END;
  
  -- User can access if their tier level is >= required tier level
  RETURN user_tier_level >= required_tier_level;
END;
$$;

-- Step 4: Create function to check if user can access a specific prompt
CREATE OR REPLACE FUNCTION public.can_access_prompt(user_id_param UUID, prompt_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prompt_category TEXT;
  required_tier TEXT;
BEGIN
  -- Get the prompt's category from metadata
  SELECT metadata->>'category' INTO prompt_category
  FROM prompts
  WHERE id = prompt_id_param;
  
  -- If no category, allow access (free content)
  IF prompt_category IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Get required tier from categories table
  SELECT required_plan INTO required_tier
  FROM categories
  WHERE name = prompt_category;
  
  -- If category doesn't exist or has no required_plan, allow access
  IF required_tier IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user can access this tier
  RETURN can_access_tier(user_id_param, required_tier);
END;
$$;

-- Step 5: Drop old overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view all prompts" ON public.prompts;

-- Step 6: Create new secure policy that enforces subscription checks
CREATE POLICY "Users can view prompts based on subscription tier" 
ON public.prompts
FOR SELECT
TO authenticated
USING (
  -- Allow access if user can access this prompt based on their subscription
  can_access_prompt(auth.uid(), id)
);

-- Step 7: Grant execute permissions on the new functions
GRANT EXECUTE ON FUNCTION public.get_user_subscription_tier(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_tier(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_prompt(UUID, UUID) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION public.get_user_subscription_tier(UUID) IS 
  'Returns the highest active subscription tier for a user (ultimate, premium, standard, basic, or free)';

COMMENT ON FUNCTION public.can_access_tier(UUID, TEXT) IS 
  'Checks if a user has an active subscription tier that meets or exceeds the required tier. Admins always return true.';

COMMENT ON FUNCTION public.can_access_prompt(UUID, UUID) IS 
  'Checks if a user can access a specific prompt based on their subscription tier and the prompt''s category required_plan.';

COMMENT ON POLICY "Users can view prompts based on subscription tier" ON public.prompts IS
  'Server-side enforcement: Users can only SELECT prompts if their subscription tier meets the category''s required_plan. Prevents client-side bypass of premium content locks.';