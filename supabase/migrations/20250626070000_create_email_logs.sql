
-- Create email_logs table for tracking email attempts
CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email_address text NOT NULL,
  email_type text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  error_message text,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  attempted_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON public.email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON public.email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_attempted_at ON public.email_logs(attempted_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_success ON public.email_logs(success);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admin users can view email logs" ON public.email_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System can insert email logs" ON public.email_logs
  FOR INSERT WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT ON public.email_logs TO authenticated;
GRANT SELECT, INSERT ON public.email_logs TO service_role;
