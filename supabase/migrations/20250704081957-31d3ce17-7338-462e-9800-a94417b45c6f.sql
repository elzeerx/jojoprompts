
-- First, let's identify and fix the duplicate active subscriptions
-- Cancel older active subscriptions when a user has multiple active ones
UPDATE user_subscriptions 
SET status = 'cancelled', updated_at = now()
WHERE id IN (
  SELECT us1.id 
  FROM user_subscriptions us1
  INNER JOIN user_subscriptions us2 ON us1.user_id = us2.user_id
  WHERE us1.status = 'active' 
    AND us2.status = 'active'
    AND us1.created_at < us2.created_at
);

-- Create a function to ensure only one active subscription per user
CREATE OR REPLACE FUNCTION public.ensure_single_active_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If inserting or updating to active status, cancel other active subscriptions for this user
  IF NEW.status = 'active' THEN
    UPDATE user_subscriptions 
    SET status = 'cancelled', updated_at = now()
    WHERE user_id = NEW.user_id 
      AND status = 'active' 
      AND id != NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to enforce single active subscription
DROP TRIGGER IF EXISTS ensure_single_active_subscription_trigger ON user_subscriptions;
CREATE TRIGGER ensure_single_active_subscription_trigger
  BEFORE INSERT OR UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_active_subscription();

-- Add index for better performance on subscription queries
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status_created 
ON user_subscriptions(user_id, status, created_at DESC);
