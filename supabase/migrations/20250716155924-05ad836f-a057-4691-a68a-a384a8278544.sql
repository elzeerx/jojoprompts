-- Create table for Apple email logs
CREATE TABLE public.apple_email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error_message TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  email_type TEXT NOT NULL CHECK (email_type IN ('signup', 'reset', 'notification')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.apple_email_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for Apple email logs
CREATE POLICY "Admins can view all Apple email logs" 
ON public.apple_email_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert Apple email logs" 
ON public.apple_email_logs 
FOR INSERT 
WITH CHECK (true);

-- Create index for better performance
CREATE INDEX idx_apple_email_logs_email ON public.apple_email_logs(email);
CREATE INDEX idx_apple_email_logs_timestamp ON public.apple_email_logs(timestamp);
CREATE INDEX idx_apple_email_logs_status ON public.apple_email_logs(status);