
-- Remove the old validate_discount_code function that doesn't have plan validation
-- This will eliminate the conflict and ensure only the new function with plan validation is used
DROP FUNCTION IF EXISTS public.validate_discount_code(code_text text);
