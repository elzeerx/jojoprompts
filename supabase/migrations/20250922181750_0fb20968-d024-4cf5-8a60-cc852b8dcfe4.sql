-- Phase 1: Critical Security Fixes

-- 1.1 Fix Public Data Exposure - Restrict prompt_shares table access
DROP POLICY IF EXISTS "Anyone can view share analytics" ON public.prompt_shares;
DROP POLICY IF EXISTS "Authenticated users can view prompt shares" ON public.prompt_shares;

-- Create secure policy for prompt_shares - only authenticated users can view their own shares
CREATE POLICY "Users can view own prompt shares" ON public.prompt_shares
FOR SELECT USING (auth.uid() = shared_by);

-- Admins can view all shares for analytics
CREATE POLICY "Admins can view all prompt shares" ON public.prompt_shares
FOR SELECT USING (is_admin());

-- 1.2 Secure Email Systems - Restrict email engagement data access
DROP POLICY IF EXISTS "System can insert email engagement data" ON public.email_engagement;
CREATE POLICY "System can insert email engagement data" ON public.email_engagement
FOR INSERT WITH CHECK (auth.uid() IS NULL); -- Only system processes can insert

-- Add stricter unsubscribe policy with rate limiting support
CREATE TABLE IF NOT EXISTS public.unsubscribe_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  email TEXT NOT NULL,
  attempts INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT now(),
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on rate limits table
ALTER TABLE public.unsubscribe_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only system can manage rate limits
CREATE POLICY "System can manage unsubscribe rate limits" ON public.unsubscribe_rate_limits
FOR ALL USING (auth.uid() IS NULL);

-- 1.3 Authentication Security - Add session integrity table
CREATE TABLE IF NOT EXISTS public.session_integrity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_token_hash TEXT NOT NULL,
  fingerprint_hash TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  is_valid BOOLEAN DEFAULT true,
  last_activity TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on session integrity
ALTER TABLE public.session_integrity ENABLE ROW LEVEL SECURITY;

-- Users can only access their own session data
CREATE POLICY "Users can view own sessions" ON public.session_integrity
FOR SELECT USING (auth.uid() = user_id);

-- System can manage all sessions
CREATE POLICY "System can manage sessions" ON public.session_integrity
FOR ALL USING (auth.uid() IS NULL OR is_admin());

-- 1.4 Enhanced Security Logging - Add security event severity levels
ALTER TABLE public.security_logs 
ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'info' CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info'));

ALTER TABLE public.security_logs 
ADD COLUMN IF NOT EXISTS event_category TEXT DEFAULT 'general' CHECK (event_category IN ('authentication', 'authorization', 'data_access', 'system', 'general'));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_logs_severity ON public.security_logs(severity);
CREATE INDEX IF NOT EXISTS idx_security_logs_category ON public.security_logs(event_category);
CREATE INDEX IF NOT EXISTS idx_session_integrity_user_id ON public.session_integrity(user_id);
CREATE INDEX IF NOT EXISTS idx_unsubscribe_rate_limits_ip ON public.unsubscribe_rate_limits(ip_address);

-- Add function to clean up expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  -- Mark sessions as invalid if inactive for more than 24 hours
  UPDATE public.session_integrity 
  SET is_valid = false 
  WHERE last_activity < now() - interval '24 hours' AND is_valid = true;
  
  -- Delete old invalid sessions (older than 7 days)
  DELETE FROM public.session_integrity 
  WHERE created_at < now() - interval '7 days' AND is_valid = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;