-- Expand email_logs table for enhanced tracking and Apple domain detection
ALTER TABLE public.email_logs 
ADD COLUMN domain_type text DEFAULT 'other',
ADD COLUMN bounce_reason text,
ADD COLUMN retry_count integer DEFAULT 0,
ADD COLUMN delivery_status text DEFAULT 'pending',
ADD COLUMN response_metadata jsonb DEFAULT '{}'::jsonb;

-- Add indexes for better performance on new columns
CREATE INDEX IF NOT EXISTS idx_email_logs_domain_type ON public.email_logs(domain_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_delivery_status ON public.email_logs(delivery_status);
CREATE INDEX IF NOT EXISTS idx_email_logs_retry_count ON public.email_logs(retry_count);

-- Add comments for documentation
COMMENT ON COLUMN public.email_logs.domain_type IS 'Type of email domain: apple, gmail, outlook, other';
COMMENT ON COLUMN public.email_logs.bounce_reason IS 'Reason for email bounce or delivery failure';
COMMENT ON COLUMN public.email_logs.retry_count IS 'Number of retry attempts for this email';
COMMENT ON COLUMN public.email_logs.delivery_status IS 'Current delivery status: pending, sent, delivered, bounced, failed';
COMMENT ON COLUMN public.email_logs.response_metadata IS 'Additional metadata from email service provider';