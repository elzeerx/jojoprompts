-- Phase 3: Rate Limiting and IP Logging Compliance

-- 1. Create rate limiting table
CREATE TABLE IF NOT EXISTS public.rate_limit_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_request_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_rate_limit_user_endpoint ON public.rate_limit_tracking(user_id, endpoint, window_start);

-- Enable RLS
ALTER TABLE public.rate_limit_tracking ENABLE ROW LEVEL SECURITY;

-- Only system can manage rate limits
CREATE POLICY "System can manage rate limits"
ON public.rate_limit_tracking
FOR ALL
USING (auth.uid() IS NULL)
WITH CHECK (auth.uid() IS NULL);

-- 2. Create rate limiting function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id UUID,
  p_endpoint TEXT,
  p_max_requests INTEGER DEFAULT 10,
  p_window_minutes INTEGER DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_current_window TIMESTAMPTZ;
  v_existing_record RECORD;
  v_allowed BOOLEAN := false;
BEGIN
  -- Calculate current rate limit window
  v_current_window := DATE_TRUNC('minute', NOW()) - (EXTRACT(MINUTE FROM NOW())::INTEGER % p_window_minutes || ' minutes')::INTERVAL;
  
  -- Get existing rate limit record for this window
  SELECT * INTO v_existing_record
  FROM public.rate_limit_tracking
  WHERE user_id = p_user_id
    AND endpoint = p_endpoint
    AND window_start = v_current_window
  FOR UPDATE;
  
  IF NOT FOUND THEN
    -- First request in this window - create new record
    INSERT INTO public.rate_limit_tracking (user_id, endpoint, request_count, window_start)
    VALUES (p_user_id, p_endpoint, 1, v_current_window);
    
    v_allowed := true;
  ELSE
    -- Check if under limit
    IF v_existing_record.request_count < p_max_requests THEN
      -- Increment counter
      UPDATE public.rate_limit_tracking
      SET request_count = request_count + 1,
          last_request_at = NOW()
      WHERE id = v_existing_record.id;
      
      v_allowed := true;
    ELSE
      -- Rate limit exceeded
      v_allowed := false;
    END IF;
  END IF;
  
  -- Return rate limit status
  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'current_count', COALESCE(v_existing_record.request_count, 0) + 1,
    'limit', p_max_requests,
    'window_minutes', p_window_minutes,
    'window_resets_at', v_current_window + (p_window_minutes || ' minutes')::INTERVAL
  );
END;
$function$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.check_rate_limit TO authenticated;

-- 3. Create IP anonymization function
CREATE OR REPLACE FUNCTION public.anonymize_ip_address(ip_address TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
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

-- 4. Update admin_audit_log to add anonymized_ip column
ALTER TABLE public.admin_audit_log 
ADD COLUMN IF NOT EXISTS anonymized_ip TEXT;

-- Create index on anonymized_ip
CREATE INDEX IF NOT EXISTS idx_admin_audit_anonymized_ip ON public.admin_audit_log(anonymized_ip);

-- 5. Create trigger to auto-anonymize IPs on insert
CREATE OR REPLACE FUNCTION public.anonymize_audit_ip()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.anonymized_ip := public.anonymize_ip_address(NEW.ip_address);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS anonymize_ip_on_insert ON public.admin_audit_log;
CREATE TRIGGER anonymize_ip_on_insert
  BEFORE INSERT ON public.admin_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.anonymize_audit_ip();

-- 6. Backfill anonymized IPs for existing records
UPDATE public.admin_audit_log 
SET anonymized_ip = public.anonymize_ip_address(ip_address)
WHERE anonymized_ip IS NULL;

-- 7. Create cleanup function for old data
CREATE OR REPLACE FUNCTION public.cleanup_security_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_audit_deleted INTEGER;
  v_rate_limit_deleted INTEGER;
  v_results JSONB;
BEGIN
  -- Cleanup old admin audit logs (keep 90 days with full IPs, older ones keep anonymized only)
  -- First, clear full IPs from old records but keep anonymized data
  UPDATE public.admin_audit_log
  SET ip_address = NULL
  WHERE timestamp < NOW() - INTERVAL '90 days'
    AND ip_address IS NOT NULL;
    
  GET DIAGNOSTICS v_audit_deleted = ROW_COUNT;
  
  -- Delete very old audit logs (older than 2 years)
  DELETE FROM public.admin_audit_log
  WHERE timestamp < NOW() - INTERVAL '2 years';
  
  -- Cleanup old rate limit tracking (keep 7 days)
  DELETE FROM public.rate_limit_tracking
  WHERE created_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS v_rate_limit_deleted = ROW_COUNT;
  
  v_results := jsonb_build_object(
    'audit_logs_anonymized', v_audit_deleted,
    'rate_limits_deleted', v_rate_limit_deleted,
    'cleanup_timestamp', NOW()
  );
  
  RETURN v_results;
END;
$function$;

-- Grant execute to service role for cron jobs
GRANT EXECUTE ON FUNCTION public.cleanup_security_data TO service_role;

-- 8. Create data retention policy records
INSERT INTO public.data_retention_policies (table_name, retention_days, deletion_criteria, is_active)
VALUES 
  ('admin_audit_log', 90, '{"criteria": "timestamp"}', true),
  ('rate_limit_tracking', 7, '{"criteria": "created_at"}', true)
ON CONFLICT DO NOTHING;

-- 9. Create admin action monitoring view
CREATE OR REPLACE VIEW public.admin_activity_summary AS
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