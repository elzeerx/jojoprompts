
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'v2_entitlement_scope' AND e.enumlabel = 'collection'
  ) THEN
    ALTER TYPE public.v2_entitlement_scope ADD VALUE 'collection';
  END IF;
END $$;
