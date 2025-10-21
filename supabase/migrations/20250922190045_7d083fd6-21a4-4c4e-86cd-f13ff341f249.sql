-- Phase 2: Data Protection & Privacy

-- 2.1 Data Classification System
-- Create data classification enum
CREATE TYPE public.data_classification AS ENUM ('public', 'internal', 'sensitive', 'restricted');

-- Create data classification metadata table
CREATE TABLE IF NOT EXISTS public.data_classification_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  classification public.data_classification NOT NULL DEFAULT 'internal',
  encryption_required BOOLEAN DEFAULT false,
  retention_days INTEGER,
  access_roles TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(table_name, column_name)
);

-- Enable RLS on classification metadata
ALTER TABLE public.data_classification_metadata ENABLE ROW LEVEL SECURITY;

-- Only admins can manage data classification
CREATE POLICY "Admins can manage data classification" ON public.data_classification_metadata
FOR ALL USING (is_admin());

-- 2.3 Privacy Control Implementation
-- Create privacy consent table
CREATE TABLE IF NOT EXISTS public.user_privacy_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  consent_type TEXT NOT NULL,
  consent_given BOOLEAN NOT NULL DEFAULT false,
  consent_version TEXT NOT NULL DEFAULT '1.0',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  UNIQUE(user_id, consent_type, consent_version)
);

-- Enable RLS on privacy consent
ALTER TABLE public.user_privacy_consent ENABLE ROW LEVEL SECURITY;

-- Users can view their own consent records
CREATE POLICY "Users can view own consent" ON public.user_privacy_consent
FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own consent records
CREATE POLICY "Users can give consent" ON public.user_privacy_consent
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can view all consent records
CREATE POLICY "Admins can view all consent" ON public.user_privacy_consent
FOR SELECT USING (is_admin());

-- Create data retention policies table
CREATE TABLE IF NOT EXISTS public.data_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  retention_days INTEGER NOT NULL,
  deletion_criteria JSONB DEFAULT '{}',
  last_cleanup_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on retention policies
ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

-- Only admins can manage retention policies
CREATE POLICY "Admins can manage retention policies" ON public.data_retention_policies
FOR ALL USING (is_admin());

-- 2.4 Advanced Admin Verification
-- Create admin access tokens table for sensitive operations
CREATE TABLE IF NOT EXISTS public.admin_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  token_hash TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  ip_address TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  is_valid BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on admin access tokens
ALTER TABLE public.admin_access_tokens ENABLE ROW LEVEL SECURITY;

-- Only the token owner or system can access
CREATE POLICY "Token owner can access" ON public.admin_access_tokens
FOR SELECT USING (auth.uid() = admin_user_id OR auth.uid() IS NULL);

-- Create admin IP restrictions table
CREATE TABLE IF NOT EXISTS public.admin_ip_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  allowed_ip_ranges TEXT[] NOT NULL,
  restriction_type TEXT NOT NULL DEFAULT 'whitelist',
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on IP restrictions
ALTER TABLE public.admin_ip_restrictions ENABLE ROW LEVEL SECURITY;

-- Only admins can manage IP restrictions
CREATE POLICY "Admins can manage IP restrictions" ON public.admin_ip_restrictions
FOR ALL USING (is_admin());

-- Insert default data classification for existing tables
INSERT INTO public.data_classification_metadata (table_name, column_name, classification, encryption_required, access_roles) VALUES
  ('profiles', 'phone_number', 'sensitive', true, ARRAY['admin', 'self']),
  ('profiles', 'email', 'internal', false, ARRAY['admin', 'self']),
  ('profiles', 'first_name', 'internal', false, ARRAY['admin', 'self']),
  ('profiles', 'last_name', 'internal', false, ARRAY['admin', 'self']),
  ('profiles', 'social_links', 'sensitive', true, ARRAY['admin', 'self']),
  ('security_logs', 'user_id', 'internal', false, ARRAY['admin']),
  ('security_logs', 'ip_address', 'sensitive', true, ARRAY['admin']),
  ('security_logs', 'details', 'internal', false, ARRAY['admin']),
  ('email_logs', 'email_address', 'sensitive', true, ARRAY['admin']),
  ('transactions', 'amount_usd', 'sensitive', false, ARRAY['admin', 'self']),
  ('user_subscriptions', 'payment_id', 'restricted', true, ARRAY['admin'])
ON CONFLICT (table_name, column_name) DO NOTHING;

-- Insert default retention policies
INSERT INTO public.data_retention_policies (table_name, retention_days, deletion_criteria) VALUES
  ('security_logs', 365, '{"auto_delete": true, "criteria": "created_at"}'),
  ('email_logs', 180, '{"auto_delete": true, "criteria": "created_at"}'),
  ('session_integrity', 30, '{"auto_delete": true, "criteria": "created_at"}'),
  ('unsubscribe_rate_limits', 90, '{"auto_delete": true, "criteria": "created_at"}'),
  ('admin_access_tokens', 7, '{"auto_delete": true, "criteria": "created_at"}')
ON CONFLICT DO NOTHING;

-- Create function to cleanup expired data based on retention policies
CREATE OR REPLACE FUNCTION public.cleanup_expired_data()
RETURNS json AS $$
DECLARE
  policy_record RECORD;
  cleanup_count INTEGER;
  total_cleaned INTEGER := 0;
  cleanup_results JSONB := '{}';
BEGIN
  -- Only allow admins or system to run cleanup
  IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  FOR policy_record IN 
    SELECT * FROM public.data_retention_policies 
    WHERE is_active = true
  LOOP
    BEGIN
      -- Execute dynamic cleanup based on policy
      EXECUTE format(
        'DELETE FROM %I WHERE %s < now() - interval ''%s days''',
        policy_record.table_name,
        policy_record.deletion_criteria->>'criteria',
        policy_record.retention_days
      );
      
      GET DIAGNOSTICS cleanup_count = ROW_COUNT;
      total_cleaned := total_cleaned + cleanup_count;
      
      cleanup_results := cleanup_results || jsonb_build_object(
        policy_record.table_name, cleanup_count
      );
      
      -- Update last cleanup timestamp
      UPDATE public.data_retention_policies 
      SET last_cleanup_at = now(), updated_at = now()
      WHERE id = policy_record.id;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue with other policies
      cleanup_results := cleanup_results || jsonb_build_object(
        policy_record.table_name || '_error', SQLERRM
      );
    END;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'total_records_cleaned', total_cleaned,
    'cleanup_details', cleanup_results,
    'cleanup_timestamp', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function for GDPR data export
CREATE OR REPLACE FUNCTION public.export_user_data(target_user_id UUID)
RETURNS json AS $$
DECLARE
  user_data JSONB := '{}';
  table_record RECORD;
  dynamic_query TEXT;
  table_data JSONB;
BEGIN
  -- Security check: users can export their own data, admins can export any user's data
  IF auth.uid() != target_user_id AND NOT is_admin() THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  -- Export data from all tables that contain user data
  FOR table_record IN 
    SELECT DISTINCT table_name 
    FROM information_schema.columns 
    WHERE column_name = 'user_id' 
    AND table_schema = 'public'
  LOOP
    BEGIN
      dynamic_query := format(
        'SELECT to_jsonb(array_agg(row_to_json(t))) FROM (SELECT * FROM %I WHERE user_id = $1) t',
        table_record.table_name
      );
      
      EXECUTE dynamic_query INTO table_data USING target_user_id;
      
      IF table_data IS NOT NULL AND table_data != 'null' THEN
        user_data := user_data || jsonb_build_object(table_record.table_name, table_data);
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      -- Skip tables that cause errors
      CONTINUE;
    END;
  END LOOP;

  -- Add profile data
  SELECT to_jsonb(profiles) INTO table_data 
  FROM profiles WHERE id = target_user_id;
  
  IF table_data IS NOT NULL THEN
    user_data := user_data || jsonb_build_object('profile', table_data);
  END IF;

  RETURN json_build_object(
    'success', true,
    'user_id', target_user_id,
    'export_timestamp', now(),
    'data', user_data
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_data_classification_table_column ON public.data_classification_metadata(table_name, column_name);
CREATE INDEX IF NOT EXISTS idx_privacy_consent_user_type ON public.user_privacy_consent(user_id, consent_type);
CREATE INDEX IF NOT EXISTS idx_admin_tokens_user_valid ON public.admin_access_tokens(admin_user_id, is_valid);
CREATE INDEX IF NOT EXISTS idx_retention_policies_active ON public.data_retention_policies(is_active);