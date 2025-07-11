-- Fix search_path security warning for validate_lifetime_subscription_end_date function
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
$$ LANGUAGE plpgsql SET search_path TO 'public';