-- Create table for email magic tokens
CREATE TABLE public.email_magic_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  token_type TEXT NOT NULL DEFAULT 'pricing_link',
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.email_magic_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "System can manage magic tokens" 
ON public.email_magic_tokens 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_email_magic_tokens_token ON public.email_magic_tokens(token);
CREATE INDEX idx_email_magic_tokens_user_id ON public.email_magic_tokens(user_id);
CREATE INDEX idx_email_magic_tokens_expires_at ON public.email_magic_tokens(expires_at);

-- Create function to clean up expired tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_magic_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM public.email_magic_tokens 
  WHERE expires_at < now() OR used_at IS NOT NULL;
END;
$$;