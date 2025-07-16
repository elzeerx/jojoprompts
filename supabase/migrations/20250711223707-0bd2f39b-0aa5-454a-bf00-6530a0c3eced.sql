-- Fix all existing lifetime subscriptions that have incorrect end_date
UPDATE user_subscriptions 
SET end_date = NULL, updated_at = now()
WHERE plan_id IN (
  SELECT id 
  FROM subscription_plans 
  WHERE is_lifetime = true
) 
AND end_date IS NOT NULL;

-- Specifically fix the user aa711ss@gmail.com subscription
UPDATE user_subscriptions 
SET end_date = NULL, updated_at = now()
WHERE id = 'c778d660-a859-47fe-81a6-10fa4b884dc2';

-- Add a check constraint to prevent future lifetime subscriptions from having end dates
-- Using a trigger instead of CHECK constraint for better reliability
CREATE OR REPLACE FUNCTION validate_lifetime_subscription_end_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the plan is lifetime
  IF EXISTS (
    SELECT 1 FROM subscription_plans 
    WHERE id = NEW.plan_id AND is_lifetime = true
  ) THEN
    -- Force end_date to NULL for lifetime plans
    NEW.end_date := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically handle lifetime subscriptions
DROP TRIGGER IF EXISTS ensure_lifetime_subscription_no_end_date ON user_subscriptions;
CREATE TRIGGER ensure_lifetime_subscription_no_end_date
  BEFORE INSERT OR UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION validate_lifetime_subscription_end_date();