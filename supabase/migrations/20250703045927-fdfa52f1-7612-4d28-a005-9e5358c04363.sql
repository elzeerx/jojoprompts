-- Fix the calculate_upgrade_cost function
CREATE OR REPLACE FUNCTION public.calculate_upgrade_cost(
  current_plan_id UUID,
  new_plan_id UUID,
  current_subscription_end DATE
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_plan RECORD;
  new_plan RECORD;
  remaining_days INTEGER;
  remaining_value NUMERIC;
  upgrade_cost NUMERIC;
  result JSON;
BEGIN
  -- Get current plan details
  SELECT * INTO current_plan FROM subscription_plans WHERE id = current_plan_id;
  SELECT * INTO new_plan FROM subscription_plans WHERE id = new_plan_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Plan not found');
  END IF;
  
  -- Calculate remaining days for current subscription (fixed: removed EXTRACT)
  remaining_days := (current_subscription_end - CURRENT_DATE);
  
  -- For lifetime plans, no proration on current plan
  IF current_plan.is_lifetime THEN
    remaining_value := 0;
  ELSE
    -- Calculate remaining value based on remaining days (assuming 365 days per year)
    remaining_value := (remaining_days::NUMERIC / 365) * current_plan.price_usd;
  END IF;
  
  -- Calculate upgrade cost (difference minus remaining value)
  upgrade_cost := new_plan.price_usd - current_plan.price_usd - remaining_value;
  
  -- Ensure upgrade cost is not negative
  IF upgrade_cost < 0 THEN
    upgrade_cost := 0;
  END IF;
  
  RETURN json_build_object(
    'current_plan_price', current_plan.price_usd,
    'new_plan_price', new_plan.price_usd,
    'remaining_days', remaining_days,
    'remaining_value', remaining_value,
    'upgrade_cost', upgrade_cost,
    'savings', remaining_value
  );
END;
$$;