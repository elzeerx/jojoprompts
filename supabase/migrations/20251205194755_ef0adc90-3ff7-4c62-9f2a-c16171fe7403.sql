-- Fix security issue: admin_activity_summary view is publicly readable
-- Recreate the view with security_invoker = true to respect RLS policies

DROP VIEW IF EXISTS public.admin_activity_summary;

CREATE VIEW public.admin_activity_summary
WITH (security_invoker = true)
AS
SELECT 
    admin_user_id,
    action,
    count(*) AS action_count,
    min(timestamp) AS first_occurrence,
    max(timestamp) AS last_occurrence,
    anonymized_ip
FROM admin_audit_log
WHERE timestamp > (now() - '24:00:00'::interval)
GROUP BY admin_user_id, action, anonymized_ip
HAVING count(*) > 10;

-- Add comment explaining the security measure
COMMENT ON VIEW public.admin_activity_summary IS 'Admin activity summary view - security_invoker enabled to respect RLS policies on admin_audit_log';