-- Create email_engagement table for tracking email interaction metrics
CREATE TABLE public.email_engagement (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_address TEXT NOT NULL,
  domain TEXT NOT NULL,
  email_opened BOOLEAN DEFAULT FALSE,
  link_clicked BOOLEAN DEFAULT FALSE,
  marked_as_spam BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.email_engagement ENABLE ROW LEVEL SECURITY;

-- Create policies for email engagement tracking
CREATE POLICY "System can insert email engagement data" 
ON public.email_engagement 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins can view all email engagement data" 
ON public.email_engagement 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- Create index for performance
CREATE INDEX idx_email_engagement_email_address ON public.email_engagement(email_address);
CREATE INDEX idx_email_engagement_domain ON public.email_engagement(domain);
CREATE INDEX idx_email_engagement_timestamp ON public.email_engagement(timestamp);

-- Create trigger to update updated_at column
CREATE OR REPLACE FUNCTION public.update_email_engagement_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_email_engagement_updated_at
  BEFORE UPDATE ON public.email_engagement
  FOR EACH ROW
  EXECUTE FUNCTION public.update_email_engagement_updated_at();