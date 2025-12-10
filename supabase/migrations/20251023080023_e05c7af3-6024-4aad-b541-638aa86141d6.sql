-- =====================================================
-- FIX REMAINING SEARCH PATH WARNING
-- =====================================================

-- Fix log_sensitive_data_access function to include search_path
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access(
  p_user_id uuid,
  p_table_name text,
  p_accessed_user_id uuid,
  p_fields text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_audit_log (
    admin_user_id,
    action,
    target_resource,
    metadata,
    ip_address
  ) VALUES (
    p_user_id,
    'sensitive_data_access',
    p_table_name,
    jsonb_build_object(
      'accessed_user_id', p_accessed_user_id,
      'fields', p_fields,
      'timestamp', NOW()
    ),
    current_setting('request.headers', true)::json->>'x-forwarded-for'
  );
END;
$$;

-- =====================================================
-- ALL SECURITY LINTER WARNINGS NOW RESOLVED
-- =====================================================