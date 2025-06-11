
-- Add missing database grants for proper access control

-- Grant anon select access to subscriptions, deny write
GRANT SELECT ON public.subscriptions TO anon;
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM anon;

-- Grant service role access to both tables for edge functions
GRANT ALL ON public.subscriptions TO service_role;
GRANT ALL ON public.payments_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE payments_log_id_seq TO service_role;
