-- Fix security linter warnings from Phase 3

-- 1. Fix security definer view - recreate without SECURITY DEFINER
DROP VIEW IF EXISTS public.admin_activity_summary;
CREATE VIEW public.admin_activity_summary 
WITH (security_invoker = true)
AS
SELECT 
  admin_user_id,
  action,
  COUNT(*) as action_count,
  MIN(timestamp) as first_occurrence,
  MAX(timestamp) as last_occurrence,
  anonymized_ip
FROM public.admin_audit_log
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY admin_user_id, action, anonymized_ip
HAVING COUNT(*) > 10;

-- Grant read access to admins
GRANT SELECT ON public.admin_activity_summary TO authenticated;

-- 2. Fix anonymize_audit_ip function - add search_path
CREATE OR REPLACE FUNCTION public.anonymize_audit_ip()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  NEW.anonymized_ip := public.anonymize_ip_address(NEW.ip_address);
  RETURN NEW;
END;
$function$;

-- Recreate trigger
DROP TRIGGER IF EXISTS anonymize_ip_on_insert ON public.admin_audit_log;
CREATE TRIGGER anonymize_ip_on_insert
  BEFORE INSERT ON public.admin_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.anonymize_audit_ip();

-- 3. Fix anonymize_ip_address function - add search_path
CREATE OR REPLACE FUNCTION public.anonymize_ip_address(ip_address TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = 'public'
AS $function$
BEGIN
  IF ip_address IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Check if IPv4 (contains dots)
  IF ip_address LIKE '%.%.%.%' THEN
    -- Mask last octet of IPv4: 192.168.1.123 -> 192.168.1.0
    RETURN REGEXP_REPLACE(ip_address, '\.\d+$', '.0');
  ELSE
    -- Mask last 80 bits of IPv6 (keep first 48 bits)
    -- For simplicity, replace everything after 3rd colon group
    RETURN REGEXP_REPLACE(ip_address, '(([0-9a-fA-F]{1,4}:){3})[0-9a-fA-F:]+', '\1:0:0:0:0:0');
  END IF;
END;
$function$;