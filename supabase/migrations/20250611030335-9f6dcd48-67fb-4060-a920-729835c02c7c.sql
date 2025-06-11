
-- First, let's restructure the subscriptions table to match the specification
-- We'll preserve existing data by migrating it to the new structure

-- Create the new payments_log table for comprehensive webhook logging
CREATE TABLE public.payments_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  tap_charge TEXT,
  status TEXT,
  payload JSONB,
  logged_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create a new subscriptions table with the exact structure specified
CREATE TABLE public.subscriptions_new (
  user_id UUID PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_end TIMESTAMP WITH TIME ZONE,
  tap_charge TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Migrate existing subscription data to new structure
INSERT INTO public.subscriptions_new (user_id, status, current_period_end, tap_charge, created_at)
SELECT 
  user_id,
  CASE 
    WHEN status = 'active' THEN 'active'
    ELSE 'inactive'
  END as status,
  expires_at as current_period_end,
  provider_tx_id as tap_charge,
  created_at
FROM public.subscriptions
WHERE provider = 'tap' OR provider IS NULL;

-- Drop old subscriptions table and rename new one
DROP TABLE public.subscriptions;
ALTER TABLE public.subscriptions_new RENAME TO subscriptions;

-- Enable RLS on both tables
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for subscriptions
CREATE POLICY "Users can view active subscriptions" 
  ON public.subscriptions 
  FOR SELECT 
  USING (status = 'active' AND current_period_end > now());

-- Grant anon select access to subscriptions, deny write
GRANT SELECT ON public.subscriptions TO anon;
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM anon;

-- Create RLS policies for payments_log (admin access only)
CREATE POLICY "Admin can view payments log" 
  ON public.payments_log 
  FOR ALL 
  USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- Grant service role access to both tables for edge functions
GRANT ALL ON public.subscriptions TO service_role;
GRANT ALL ON public.payments_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE payments_log_id_seq TO service_role;
