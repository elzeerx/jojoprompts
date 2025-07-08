
-- Drop the calculate_upgrade_cost function since we're simplifying to just price difference
DROP FUNCTION IF EXISTS public.calculate_upgrade_cost(UUID, UUID, DATE);

-- Remove proration-related columns from transactions table since we're not using complex calculations
ALTER TABLE public.transactions 
DROP COLUMN IF EXISTS prorate_amount;
