-- Fix security issue: Explicitly set view to SECURITY INVOKER
-- This ensures RLS policies on underlying tables are respected
-- and the view uses the permissions of the querying user, not the view creator

ALTER VIEW v_admin_users SET (security_invoker = true);