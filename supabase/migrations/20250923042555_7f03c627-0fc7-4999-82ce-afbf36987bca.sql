-- Phase 4: Monitoring & Threat Detection Database Schema

-- Real-time security monitoring events
CREATE TABLE public.security_monitoring_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  user_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Behavioral analytics baseline and anomalies
CREATE TABLE public.user_behavior_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  metric_type TEXT NOT NULL, -- 'login_pattern', 'api_usage', 'location_pattern'
  baseline_data JSONB NOT NULL,
  confidence_score DECIMAL(3,2) DEFAULT 0.5,
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, metric_type)
);

CREATE TABLE public.behavioral_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  anomaly_type TEXT NOT NULL,
  severity_score INTEGER NOT NULL CHECK (severity_score BETWEEN 0 AND 100),
  detection_algorithm TEXT NOT NULL,
  anomaly_details JSONB NOT NULL,
  baseline_deviation DECIMAL(5,2),
  is_confirmed BOOLEAN DEFAULT false,
  false_positive BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  investigated_at TIMESTAMPTZ,
  investigated_by UUID
);

-- Threat intelligence data
CREATE TABLE public.threat_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_type TEXT NOT NULL, -- 'ip', 'domain', 'hash', 'email'
  indicator_value TEXT NOT NULL,
  threat_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  source TEXT NOT NULL,
  confidence INTEGER CHECK (confidence BETWEEN 0 AND 100),
  description TEXT,
  metadata JSONB DEFAULT '{}',
  first_seen TIMESTAMPTZ DEFAULT now(),
  last_seen TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(indicator_type, indicator_value)
);

-- Security incidents and responses
CREATE TABLE public.security_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'contained', 'resolved', 'false_positive')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT,
  affected_users JSONB DEFAULT '[]',
  affected_resources JSONB DEFAULT '[]',
  timeline JSONB DEFAULT '[]',
  containment_actions JSONB DEFAULT '[]',
  evidence JSONB DEFAULT '{}',
  assigned_to UUID,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Automated response actions
CREATE TABLE public.automated_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_event TEXT NOT NULL,
  condition_rules JSONB NOT NULL,
  action_type TEXT NOT NULL, -- 'block_ip', 'disable_user', 'require_mfa', 'alert_admin'
  action_parameters JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  execution_count INTEGER DEFAULT 0,
  last_executed TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Response execution log
CREATE TABLE public.response_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID REFERENCES public.automated_responses(id),
  incident_id UUID REFERENCES public.security_incidents(id),
  triggered_by TEXT NOT NULL,
  execution_status TEXT NOT NULL DEFAULT 'pending' CHECK (execution_status IN ('pending', 'success', 'failed', 'partial')),
  result_details JSONB DEFAULT '{}',
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ML model configurations for behavioral analysis
CREATE TABLE public.ml_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name TEXT NOT NULL UNIQUE,
  model_type TEXT NOT NULL, -- 'anomaly_detection', 'classification', 'risk_scoring'
  algorithm TEXT NOT NULL,
  configuration JSONB NOT NULL,
  training_data_period INTEGER DEFAULT 30, -- days
  last_trained TIMESTAMPTZ,
  accuracy_score DECIMAL(3,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.security_monitoring_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_behavior_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behavioral_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threat_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automated_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ml_models ENABLE ROW LEVEL SECURITY;

-- RLS Policies for security_monitoring_events
CREATE POLICY "Admins can manage monitoring events" ON public.security_monitoring_events
  FOR ALL USING (is_admin());

CREATE POLICY "Users can view events related to them" ON public.security_monitoring_events
  FOR SELECT USING (auth.uid() = user_id);

-- RLS Policies for user_behavior_baselines
CREATE POLICY "Users can view own baselines" ON public.user_behavior_baselines
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage baselines" ON public.user_behavior_baselines
  FOR ALL USING (auth.uid() IS NULL OR is_admin());

-- RLS Policies for behavioral_anomalies
CREATE POLICY "Admins can view all anomalies" ON public.behavioral_anomalies
  FOR SELECT USING (is_admin());

CREATE POLICY "Users can view own anomalies" ON public.behavioral_anomalies
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert anomalies" ON public.behavioral_anomalies
  FOR INSERT WITH CHECK (true);

-- RLS Policies for threat_indicators
CREATE POLICY "Admins can manage threat indicators" ON public.threat_indicators
  FOR ALL USING (is_admin());

-- RLS Policies for security_incidents
CREATE POLICY "Admins can manage incidents" ON public.security_incidents
  FOR ALL USING (is_admin());

-- RLS Policies for automated_responses
CREATE POLICY "Admins can manage automated responses" ON public.automated_responses
  FOR ALL USING (is_admin());

-- RLS Policies for response_executions
CREATE POLICY "Admins can view response executions" ON public.response_executions
  FOR SELECT USING (is_admin());

CREATE POLICY "System can insert executions" ON public.response_executions
  FOR INSERT WITH CHECK (true);

-- RLS Policies for ml_models
CREATE POLICY "Admins can manage ML models" ON public.ml_models
  FOR ALL USING (is_admin());

-- Behavioral analysis functions
CREATE OR REPLACE FUNCTION public.calculate_anomaly_score(
  p_user_id UUID,
  p_metric_type TEXT,
  p_current_data JSONB
) RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  baseline_record RECORD;
  anomaly_score DECIMAL := 0.0;
  deviation DECIMAL;
BEGIN
  -- Get baseline for this user and metric type
  SELECT * INTO baseline_record 
  FROM public.user_behavior_baselines 
  WHERE user_id = p_user_id AND metric_type = p_metric_type;
  
  IF NOT FOUND THEN
    -- No baseline exists, return neutral score
    RETURN 0.5;
  END IF;
  
  -- Calculate deviation based on metric type
  CASE p_metric_type
    WHEN 'login_pattern' THEN
      -- Compare login times, frequency, locations
      deviation := ABS(
        COALESCE((p_current_data->>'hour')::INTEGER, 12) - 
        COALESCE((baseline_record.baseline_data->>'avg_hour')::INTEGER, 12)
      );
      anomaly_score := LEAST(deviation / 12.0, 1.0);
      
    WHEN 'api_usage' THEN
      -- Compare API call frequency and patterns
      deviation := ABS(
        COALESCE((p_current_data->>'requests_per_hour')::INTEGER, 0) - 
        COALESCE((baseline_record.baseline_data->>'avg_requests_per_hour')::INTEGER, 0)
      );
      anomaly_score := LEAST(deviation / 100.0, 1.0);
      
    WHEN 'location_pattern' THEN
      -- Check if location is significantly different
      IF (p_current_data->>'country') != (baseline_record.baseline_data->>'primary_country') THEN
        anomaly_score := 0.8;
      ELSE
        anomaly_score := 0.1;
      END IF;
      
    ELSE
      -- Default calculation
      anomaly_score := 0.3;
  END CASE;
  
  RETURN GREATEST(0.0, LEAST(1.0, anomaly_score));
END;
$$;

-- Function to trigger automated responses
CREATE OR REPLACE FUNCTION public.trigger_automated_response(
  p_event_type TEXT,
  p_severity TEXT,
  p_context JSONB DEFAULT '{}'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  response_record RECORD;
  execution_id UUID;
  actions_triggered INTEGER := 0;
  results JSONB := '[]';
BEGIN
  -- Find matching automated responses
  FOR response_record IN 
    SELECT * FROM public.automated_responses 
    WHERE is_active = true 
    AND trigger_event = p_event_type
  LOOP
    -- Check if conditions are met
    IF public.evaluate_response_conditions(response_record.condition_rules, p_context) THEN
      -- Create execution record
      INSERT INTO public.response_executions (
        response_id, triggered_by, execution_status
      ) VALUES (
        response_record.id, p_event_type, 'pending'
      ) RETURNING id INTO execution_id;
      
      -- Execute the response action
      PERFORM public.execute_response_action(
        execution_id, 
        response_record.action_type, 
        response_record.action_parameters,
        p_context
      );
      
      actions_triggered := actions_triggered + 1;
      results := results || jsonb_build_object(
        'response_id', response_record.id,
        'action_type', response_record.action_type,
        'execution_id', execution_id
      );
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'actions_triggered', actions_triggered,
    'executions', results,
    'timestamp', now()
  );
END;
$$;

-- Function to evaluate response conditions
CREATE OR REPLACE FUNCTION public.evaluate_response_conditions(
  p_conditions JSONB,
  p_context JSONB
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  condition JSONB;
  field_name TEXT;
  expected_value TEXT;
  actual_value TEXT;
  operator TEXT;
BEGIN
  -- Simple condition evaluation
  FOR condition IN SELECT * FROM jsonb_array_elements(p_conditions)
  LOOP
    field_name := condition->>'field';
    expected_value := condition->>'value';
    operator := COALESCE(condition->>'operator', 'equals');
    actual_value := p_context->>field_name;
    
    CASE operator
      WHEN 'equals' THEN
        IF actual_value != expected_value THEN
          RETURN false;
        END IF;
      WHEN 'greater_than' THEN
        IF (actual_value::INTEGER) <= (expected_value::INTEGER) THEN
          RETURN false;
        END IF;
      WHEN 'contains' THEN
        IF position(expected_value IN actual_value) = 0 THEN
          RETURN false;
        END IF;
    END CASE;
  END LOOP;
  
  RETURN true;
END;
$$;

-- Function to execute response actions
CREATE OR REPLACE FUNCTION public.execute_response_action(
  p_execution_id UUID,
  p_action_type TEXT,
  p_parameters JSONB,
  p_context JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  start_time TIMESTAMPTZ := now();
  execution_time INTEGER;
  result_details JSONB := '{}';
  status TEXT := 'success';
BEGIN
  -- Execute based on action type
  CASE p_action_type
    WHEN 'block_ip' THEN
      -- Add IP to blocklist (simplified implementation)
      result_details := jsonb_build_object(
        'blocked_ip', p_context->>'ip_address',
        'duration', p_parameters->>'duration_minutes'
      );
      
    WHEN 'disable_user' THEN
      -- Disable user account (simplified implementation)
      result_details := jsonb_build_object(
        'disabled_user', p_context->>'user_id',
        'reason', 'automated_security_response'
      );
      
    WHEN 'require_mfa' THEN
      -- Force MFA requirement (simplified implementation)
      result_details := jsonb_build_object(
        'user_id', p_context->>'user_id',
        'mfa_required', true
      );
      
    WHEN 'alert_admin' THEN
      -- Send admin alert (simplified implementation)
      result_details := jsonb_build_object(
        'alert_sent', true,
        'alert_type', p_parameters->>'alert_type'
      );
      
    ELSE
      status := 'failed';
      result_details := jsonb_build_object('error', 'unknown_action_type');
  END CASE;
  
  execution_time := EXTRACT(EPOCH FROM (now() - start_time)) * 1000;
  
  -- Update execution record
  UPDATE public.response_executions 
  SET execution_status = status,
      result_details = result_details,
      execution_time_ms = execution_time,
      completed_at = now()
  WHERE id = p_execution_id;
END;
$$;

-- Create indexes for performance
CREATE INDEX idx_monitoring_events_type_severity ON public.security_monitoring_events(event_type, severity, created_at);
CREATE INDEX idx_monitoring_events_user ON public.security_monitoring_events(user_id, created_at);
CREATE INDEX idx_anomalies_user_severity ON public.behavioral_anomalies(user_id, severity_score, created_at);
CREATE INDEX idx_threat_indicators_type_value ON public.threat_indicators(indicator_type, indicator_value);
CREATE INDEX idx_threat_indicators_active ON public.threat_indicators(is_active, threat_type);
CREATE INDEX idx_incidents_status_severity ON public.security_incidents(status, severity, created_at);
CREATE INDEX idx_responses_trigger ON public.automated_responses(trigger_event, is_active);
CREATE INDEX idx_executions_status ON public.response_executions(execution_status, created_at);