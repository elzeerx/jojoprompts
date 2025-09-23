-- Phase 5: Advanced Security & Compliance Database Schema

-- Compliance audit trails
CREATE TABLE public.compliance_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_type TEXT NOT NULL,
  compliance_framework TEXT NOT NULL, -- 'gdpr', 'ccpa', 'soc2', 'iso27001'
  audit_scope JSONB DEFAULT '{}',
  findings JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  auditor_id UUID,
  audit_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  completion_date TIMESTAMPTZ,
  next_audit_date TIMESTAMPTZ,
  risk_score INTEGER DEFAULT 0,
  compliance_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Security vulnerability assessments
CREATE TABLE public.security_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_type TEXT NOT NULL, -- 'vulnerability_scan', 'penetration_test', 'code_review'
  target_system TEXT NOT NULL,
  assessment_scope JSONB DEFAULT '{}',
  vulnerabilities JSONB DEFAULT '[]',
  risk_matrix JSONB DEFAULT '{}',
  remediation_plan JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'scheduled',
  severity_distribution JSONB DEFAULT '{}',
  compliance_impact JSONB DEFAULT '{}',
  conducted_by UUID,
  scheduled_date TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  next_assessment_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Business continuity plans
CREATE TABLE public.business_continuity_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name TEXT NOT NULL,
  plan_type TEXT NOT NULL, -- 'disaster_recovery', 'incident_response', 'data_backup'
  scope_description TEXT,
  recovery_objectives JSONB DEFAULT '{}', -- RTO, RPO targets
  procedures JSONB DEFAULT '[]',
  resource_requirements JSONB DEFAULT '{}',
  testing_schedule JSONB DEFAULT '{}',
  last_tested TIMESTAMPTZ,
  test_results JSONB DEFAULT '{}',
  effectiveness_score INTEGER DEFAULT 0,
  approval_status TEXT DEFAULT 'draft',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  version_number TEXT DEFAULT '1.0',
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Security training records
CREATE TABLE public.security_training_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  training_module TEXT NOT NULL,
  training_category TEXT NOT NULL, -- 'developer', 'admin', 'user', 'compliance'
  completion_status TEXT DEFAULT 'not_started',
  start_date TIMESTAMPTZ,
  completion_date TIMESTAMPTZ,
  score INTEGER,
  assessment_results JSONB DEFAULT '{}',
  certificate_issued BOOLEAN DEFAULT false,
  certificate_data JSONB DEFAULT '{}',
  expiry_date TIMESTAMPTZ,
  refresher_required BOOLEAN DEFAULT false,
  next_training_date TIMESTAMPTZ,
  training_provider TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Compliance controls matrix
CREATE TABLE public.compliance_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id TEXT NOT NULL UNIQUE,
  control_name TEXT NOT NULL,
  framework TEXT NOT NULL, -- 'gdpr', 'ccpa', 'soc2', 'iso27001'
  control_category TEXT NOT NULL,
  description TEXT,
  implementation_status TEXT DEFAULT 'not_implemented',
  implementation_details JSONB DEFAULT '{}',
  evidence_artifacts JSONB DEFAULT '[]',
  testing_frequency TEXT DEFAULT 'annual',
  last_tested TIMESTAMPTZ,
  test_results JSONB DEFAULT '{}',
  effectiveness_rating INTEGER DEFAULT 0,
  risk_rating TEXT DEFAULT 'medium',
  owner_id UUID,
  reviewer_id UUID,
  next_review_date TIMESTAMPTZ,
  exceptions JSONB DEFAULT '[]',
  remediation_plan JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Data backup and recovery logs
CREATE TABLE public.backup_recovery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL, -- 'backup', 'restore', 'test_restore'
  backup_type TEXT NOT NULL, -- 'full', 'incremental', 'differential'
  data_sources JSONB DEFAULT '[]',
  backup_location TEXT,
  operation_status TEXT DEFAULT 'in_progress',
  start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER,
  data_size_bytes BIGINT,
  compression_ratio DECIMAL,
  encryption_status TEXT DEFAULT 'encrypted',
  verification_status TEXT DEFAULT 'pending',
  verification_results JSONB DEFAULT '{}',
  error_details JSONB DEFAULT '{}',
  recovery_point_objective_met BOOLEAN,
  recovery_time_objective_met BOOLEAN,
  initiated_by UUID,
  automated BOOLEAN DEFAULT false,
  retention_policy TEXT,
  expiry_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.compliance_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_continuity_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_training_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_recovery_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for compliance_audits
CREATE POLICY "Admins can manage compliance audits" 
ON public.compliance_audits 
FOR ALL 
USING (is_admin());

-- RLS Policies for security_assessments
CREATE POLICY "Admins can manage security assessments" 
ON public.security_assessments 
FOR ALL 
USING (is_admin());

-- RLS Policies for business_continuity_plans
CREATE POLICY "Admins can manage business continuity plans" 
ON public.business_continuity_plans 
FOR ALL 
USING (is_admin());

-- RLS Policies for security_training_records
CREATE POLICY "Admins can view all training records" 
ON public.security_training_records 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Users can view own training records" 
ON public.security_training_records 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own training records" 
ON public.security_training_records 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert training records" 
ON public.security_training_records 
FOR INSERT 
WITH CHECK (true);

-- RLS Policies for compliance_controls
CREATE POLICY "Admins can manage compliance controls" 
ON public.compliance_controls 
FOR ALL 
USING (is_admin());

-- RLS Policies for backup_recovery_logs
CREATE POLICY "Admins can view backup recovery logs" 
ON public.backup_recovery_logs 
FOR SELECT 
USING (is_admin());

CREATE POLICY "System can insert backup recovery logs" 
ON public.backup_recovery_logs 
FOR INSERT 
WITH CHECK (true);

-- Database functions for compliance automation

-- Function to evaluate compliance status
CREATE OR REPLACE FUNCTION public.evaluate_compliance_status(
  p_framework TEXT,
  p_scope JSONB DEFAULT '{}'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_controls INTEGER;
  implemented_controls INTEGER;
  tested_controls INTEGER;
  effective_controls INTEGER;
  compliance_score DECIMAL;
  result JSONB;
BEGIN
  -- Count total controls for framework
  SELECT COUNT(*) INTO total_controls
  FROM public.compliance_controls
  WHERE framework = p_framework;
  
  -- Count implemented controls
  SELECT COUNT(*) INTO implemented_controls
  FROM public.compliance_controls
  WHERE framework = p_framework
    AND implementation_status = 'implemented';
    
  -- Count tested controls
  SELECT COUNT(*) INTO tested_controls
  FROM public.compliance_controls
  WHERE framework = p_framework
    AND last_tested > now() - interval '1 year';
    
  -- Count effective controls
  SELECT COUNT(*) INTO effective_controls
  FROM public.compliance_controls
  WHERE framework = p_framework
    AND effectiveness_rating >= 80;
  
  -- Calculate compliance score
  IF total_controls > 0 THEN
    compliance_score := (implemented_controls::DECIMAL / total_controls::DECIMAL) * 100;
  ELSE
    compliance_score := 0;
  END IF;
  
  result := jsonb_build_object(
    'framework', p_framework,
    'total_controls', total_controls,
    'implemented_controls', implemented_controls,
    'tested_controls', tested_controls,
    'effective_controls', effective_controls,
    'compliance_score', compliance_score,
    'evaluation_date', now()
  );
  
  RETURN result;
END;
$$;

-- Function to schedule security assessments
CREATE OR REPLACE FUNCTION public.schedule_security_assessment(
  p_assessment_type TEXT,
  p_target_system TEXT,
  p_scheduled_date TIMESTAMPTZ,
  p_scope JSONB DEFAULT '{}'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assessment_id UUID;
BEGIN
  -- Insert new assessment
  INSERT INTO public.security_assessments (
    assessment_type,
    target_system,
    assessment_scope,
    scheduled_date,
    status
  ) VALUES (
    p_assessment_type,
    p_target_system,
    p_scope,
    p_scheduled_date,
    'scheduled'
  ) RETURNING id INTO assessment_id;
  
  RETURN assessment_id;
END;
$$;

-- Function to initiate backup operation
CREATE OR REPLACE FUNCTION public.initiate_backup_operation(
  p_backup_type TEXT,
  p_data_sources JSONB,
  p_automated BOOLEAN DEFAULT false
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  backup_id UUID;
BEGIN
  -- Insert backup log entry
  INSERT INTO public.backup_recovery_logs (
    operation_type,
    backup_type,
    data_sources,
    operation_status,
    automated,
    initiated_by
  ) VALUES (
    'backup',
    p_backup_type,
    p_data_sources,
    'in_progress',
    p_automated,
    CASE WHEN p_automated THEN NULL ELSE auth.uid() END
  ) RETURNING id INTO backup_id;
  
  RETURN backup_id;
END;
$$;