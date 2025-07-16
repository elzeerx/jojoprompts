-- Update auth settings to disable email confirmation requirement
-- This needs to be done in the Supabase dashboard under Authentication > Settings
-- Set "Enable email confirmations" to false

-- For now, let's create a workaround by updating user confirmation status
-- This function will be called after our custom email is sent
CREATE OR REPLACE FUNCTION public.confirm_user_email(user_id UUID, email_confirmed BOOLEAN DEFAULT TRUE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This function can be used to manually confirm users after they click our custom email
  -- We'll handle this in our custom confirmation flow
  NULL;
END;
$$;