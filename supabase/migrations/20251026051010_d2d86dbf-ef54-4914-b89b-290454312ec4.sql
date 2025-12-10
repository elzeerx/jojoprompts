-- Phase 3: Setup automated cleanup cron job

-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily cleanup at midnight UTC
SELECT cron.schedule(
  'daily-security-cleanup',
  '0 0 * * *', -- Every day at midnight UTC
  $$
  SELECT public.cleanup_security_data();
  $$
);

-- Add comment for documentation
COMMENT ON EXTENSION pg_cron IS 'Scheduled job runner for automated database maintenance';

-- Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;