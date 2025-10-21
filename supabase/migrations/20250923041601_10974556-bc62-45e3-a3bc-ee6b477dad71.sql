-- Phase 3: Access Controls & Authorization Database Schema (Fixed)

-- Enhanced session management with concurrent session tracking
CREATE TABLE public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_token_hash TEXT NOT NULL,
  fingerprint_hash TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  location_data JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_activity TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  device_info JSONB DEFAULT '{}',
  risk_score INTEGER DEFAULT 0
);

-- API request security and rate limiting
CREATE TABLE public.api_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  request_signature TEXT,
  response_status INTEGER,
  response_time_ms INTEGER,
  risk_score INTEGER DEFAULT 0,
  is_suspicious BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Behavioral rate limiting with pattern detection
CREATE TABLE public.rate_limit_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  pattern_type TEXT NOT NULL,
  requests_count INTEGER DEFAULT 0,
  window_start TIMESTAMPTZ DEFAULT now(),
  window_duration_seconds INTEGER NOT NULL,
  max_requests INTEGER NOT NULL,
  violation_count INTEGER DEFAULT 0,
  is_blocked BOOLEAN DEFAULT false,
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Zero-trust access evaluation logs
CREATE TABLE public.access_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  action TEXT NOT NULL,
  decision TEXT NOT NULL,
  evaluation_factors JSONB DEFAULT '{}',
  risk_score INTEGER DEFAULT 0,
  context_data JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Database activity monitoring
CREATE TABLE public.database_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  affected_rows INTEGER DEFAULT 0,
  query_hash TEXT,
  execution_time_ms INTEGER,
  ip_address TEXT,
  is_suspicious BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.database_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_sessions
CREATE POLICY "Users can view own sessions" ON public.user_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON public.user_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can manage sessions" ON public.user_sessions
  FOR ALL USING (auth.uid() IS NULL OR is_admin());

-- RLS Policies for api_request_logs
CREATE POLICY "Users can view own API logs" ON public.api_request_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert API logs" ON public.api_request_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all API logs" ON public.api_request_logs
  FOR SELECT USING (is_admin());

-- RLS Policies for rate_limit_patterns
CREATE POLICY "System can manage rate limits" ON public.rate_limit_patterns
  FOR ALL USING (auth.uid() IS NULL OR is_admin());

-- RLS Policies for access_evaluations
CREATE POLICY "Users can view own access evaluations" ON public.access_evaluations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert access evaluations" ON public.access_evaluations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all access evaluations" ON public.access_evaluations
  FOR SELECT USING (is_admin());

-- RLS Policies for database_activity_log
CREATE POLICY "Admins can view database activity" ON public.database_activity_log
  FOR SELECT USING (is_admin());

CREATE POLICY "System can insert database activity" ON public.database_activity_log
  FOR INSERT WITH CHECK (true);

-- Function for zero-trust access evaluation (Fixed parameter order)
CREATE OR REPLACE FUNCTION public.evaluate_access_request(
  p_user_id UUID,
  p_resource_type TEXT,
  p_action TEXT DEFAULT 'read',
  p_resource_id TEXT DEFAULT NULL,
  p_context JSONB DEFAULT '{}'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  risk_score INTEGER := 0;
  decision TEXT := 'deny';
  evaluation_factors JSONB := '{}';
  ip_address TEXT;
  recent_activity INTEGER;
BEGIN
  -- Get user role
  SELECT role INTO user_role FROM public.profiles WHERE id = p_user_id;
  
  -- Get client IP from context
  ip_address := p_context->>'ip_address';
  
  -- Calculate risk score based on various factors
  CASE user_role
    WHEN 'admin' THEN 
      risk_score := risk_score + 10;
      evaluation_factors := evaluation_factors || jsonb_build_object('role_risk', 10);
    WHEN 'jadmin' THEN 
      risk_score := risk_score + 5;
      evaluation_factors := evaluation_factors || jsonb_build_object('role_risk', 5);
    WHEN 'prompter' THEN 
      risk_score := risk_score + 2;
      evaluation_factors := evaluation_factors || jsonb_build_object('role_risk', 2);
    ELSE
      evaluation_factors := evaluation_factors || jsonb_build_object('role_risk', 0);
  END CASE;
  
  -- Factor 2: Recent suspicious activity
  SELECT COUNT(*) INTO recent_activity 
  FROM public.security_logs 
  WHERE user_id = p_user_id 
    AND severity = 'high' 
    AND created_at > now() - interval '24 hours';
    
  IF recent_activity > 0 THEN
    risk_score := risk_score + (recent_activity * 5);
    evaluation_factors := evaluation_factors || jsonb_build_object('recent_incidents', recent_activity);
  END IF;
  
  -- Decision logic
  IF risk_score <= 10 THEN
    decision := 'allow';
  ELSIF risk_score <= 20 THEN
    decision := 'conditional';
  ELSE
    decision := 'deny';
  END IF;
  
  -- Log the evaluation
  INSERT INTO public.access_evaluations (
    user_id, resource_type, resource_id, action, decision,
    evaluation_factors, risk_score, context_data, ip_address
  ) VALUES (
    p_user_id, p_resource_type, p_resource_id, p_action, decision,
    evaluation_factors, risk_score, p_context, ip_address
  );
  
  RETURN jsonb_build_object(
    'decision', decision,
    'risk_score', risk_score,
    'factors', evaluation_factors,
    'timestamp', now()
  );
END;
$$;

-- Function for session validation with fingerprinting (Fixed parameter order)
CREATE OR REPLACE FUNCTION public.validate_session_integrity(
  p_user_id UUID,
  p_session_token_hash TEXT,
  p_fingerprint_hash TEXT,
  p_ip_address TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  session_record RECORD;
  is_valid BOOLEAN := false;
  risk_factors JSONB := '{}';
  action_required TEXT := 'none';
BEGIN
  -- Get session record
  SELECT * INTO session_record 
  FROM public.user_sessions 
  WHERE user_id = p_user_id 
    AND session_token_hash = p_session_token_hash 
    AND is_active = true
    AND expires_at > now()
  ORDER BY created_at DESC 
  LIMIT 1;
  
  IF NOT FOUND THEN
    risk_factors := risk_factors || jsonb_build_object('invalid_session', true);
    action_required := 'reauthenticate';
  ELSE
    -- Check fingerprint match
    IF session_record.fingerprint_hash != p_fingerprint_hash THEN
      risk_factors := risk_factors || jsonb_build_object('fingerprint_mismatch', true);
      action_required := 'verify_identity';
    END IF;
    
    -- Check IP change
    IF session_record.ip_address IS NOT NULL AND session_record.ip_address != p_ip_address THEN
      risk_factors := risk_factors || jsonb_build_object('ip_change', true);
      IF action_required = 'none' THEN
        action_required := 'location_verification';
      END IF;
    END IF;
    
    -- Update last activity
    UPDATE public.user_sessions 
    SET last_activity = now(),
        ip_address = COALESCE(p_ip_address, ip_address)
    WHERE id = session_record.id;
    
    -- Session is valid if no critical issues
    is_valid := (action_required IN ('none', 'location_verification'));
  END IF;
  
  RETURN jsonb_build_object(
    'is_valid', is_valid,
    'risk_factors', risk_factors,
    'action_required', action_required,
    'session_id', COALESCE(session_record.id, NULL),
    'last_activity', COALESCE(session_record.last_activity, NULL)
  );
END;
$$;

-- Function for API request security validation (Fixed parameter order)
CREATE OR REPLACE FUNCTION public.validate_api_request(
  p_endpoint TEXT,
  p_method TEXT,
  p_user_id UUID DEFAULT NULL,
  p_request_signature TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_allowed BOOLEAN := true;
  risk_score INTEGER := 0;
  rate_limit_exceeded BOOLEAN := false;
  request_count INTEGER;
  window_start TIMESTAMPTZ := now() - interval '1 hour';
BEGIN
  -- Check rate limits
  SELECT COUNT(*) INTO request_count
  FROM public.api_request_logs
  WHERE (user_id = p_user_id OR ip_address = p_ip_address)
    AND endpoint = p_endpoint
    AND created_at > window_start;
  
  -- Basic rate limit: 100 requests per hour per endpoint
  IF request_count >= 100 THEN
    rate_limit_exceeded := true;
    is_allowed := false;
    risk_score := risk_score + 50;
  END IF;
  
  -- Check for suspicious patterns
  IF p_user_agent ILIKE '%bot%' OR p_user_agent ILIKE '%crawler%' THEN
    risk_score := risk_score + 10;
  END IF;
  
  -- Log the request
  INSERT INTO public.api_request_logs (
    user_id, endpoint, method, ip_address, user_agent,
    request_signature, risk_score, is_suspicious
  ) VALUES (
    p_user_id, p_endpoint, p_method, p_ip_address, p_user_agent,
    p_request_signature, risk_score, risk_score > 20
  );
  
  RETURN jsonb_build_object(
    'allowed', is_allowed,
    'risk_score', risk_score,
    'rate_limit_exceeded', rate_limit_exceeded,
    'request_count', request_count,
    'window_remaining_seconds', EXTRACT(EPOCH FROM (window_start + interval '1 hour' - now()))
  );
END;
$$;

-- Create indexes for performance
CREATE INDEX idx_user_sessions_user_active ON public.user_sessions(user_id, is_active);
CREATE INDEX idx_user_sessions_expires ON public.user_sessions(expires_at);
CREATE INDEX idx_api_logs_user_endpoint ON public.api_request_logs(user_id, endpoint, created_at);
CREATE INDEX idx_api_logs_ip_endpoint ON public.api_request_logs(ip_address, endpoint, created_at);
CREATE INDEX idx_access_evaluations_user ON public.access_evaluations(user_id, created_at);
CREATE INDEX idx_database_activity_suspicious ON public.database_activity_log(is_suspicious, created_at);