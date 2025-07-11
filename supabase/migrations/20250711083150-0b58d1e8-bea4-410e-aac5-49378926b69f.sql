-- Remove the old validate_discount_code function that doesn't have user validation
-- This will eliminate the conflict and ensure only the new function with user validation is used
DROP FUNCTION IF EXISTS public.validate_discount_code(code_text text, plan_id_param uuid);