-- Fix function_search_path_mutable on _v2_touch_receipt_delivery_updated_at
CREATE OR REPLACE FUNCTION public._v2_touch_receipt_delivery_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Re-assert least-privilege execute grants (service_role only).
REVOKE ALL ON FUNCTION public._v2_touch_receipt_delivery_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._v2_touch_receipt_delivery_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public._v2_touch_receipt_delivery_updated_at() FROM authenticated;
GRANT EXECUTE ON FUNCTION public._v2_touch_receipt_delivery_updated_at() TO service_role;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public._v2_touch_receipt_delivery_updated_at()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not have EXECUTE on _v2_touch_receipt_delivery_updated_at';
  END IF;
  IF has_function_privilege('authenticated', 'public._v2_touch_receipt_delivery_updated_at()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must not have EXECUTE on _v2_touch_receipt_delivery_updated_at';
  END IF;
  IF NOT has_function_privilege('service_role', 'public._v2_touch_receipt_delivery_updated_at()', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role must retain EXECUTE on _v2_touch_receipt_delivery_updated_at';
  END IF;
END $$;