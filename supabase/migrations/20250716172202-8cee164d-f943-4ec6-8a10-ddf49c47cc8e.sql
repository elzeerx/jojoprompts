-- Create unsubscribed_emails table
CREATE TABLE public.unsubscribed_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  unsubscribe_type TEXT NOT NULL DEFAULT 'all',
  unsubscribed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resubscribed_at TIMESTAMP WITH TIME ZONE NULL
);

-- Enable Row Level Security
ALTER TABLE public.unsubscribed_emails ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can insert unsubscribe records" 
ON public.unsubscribed_emails 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update unsubscribe records" 
ON public.unsubscribed_emails 
FOR UPDATE 
USING (true);

CREATE POLICY "Admins can view all unsubscribed emails" 
ON public.unsubscribed_emails 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- Create index for faster email lookups
CREATE INDEX idx_unsubscribed_emails_email ON public.unsubscribed_emails(email);
CREATE INDEX idx_unsubscribed_emails_type ON public.unsubscribed_emails(unsubscribe_type);