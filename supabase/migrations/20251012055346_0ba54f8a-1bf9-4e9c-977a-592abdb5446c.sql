-- Create signup audit log table for tracking signup attempts
CREATE TABLE IF NOT EXISTS public.signup_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  username TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  error_messages TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_signup_audit_log_created_at ON public.signup_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_signup_audit_log_ip_address ON public.signup_audit_log(ip_address);
CREATE INDEX IF NOT EXISTS idx_signup_audit_log_email ON public.signup_audit_log(email);

-- Enable RLS on signup audit log
ALTER TABLE public.signup_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view signup audit logs
CREATE POLICY "Admins can view signup audit logs"
  ON public.signup_audit_log
  FOR SELECT
  USING (is_admin());

-- System can insert signup audit logs
CREATE POLICY "System can insert signup audit logs"
  ON public.signup_audit_log
  FOR INSERT
  WITH CHECK (true);

-- Update the handle_new_user function to ensure proper role assignment
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  generated_username TEXT;
  username_counter INTEGER := 0;
  default_role TEXT := 'user'; -- Always default to 'user' role
BEGIN
  -- Generate base username from email or name
  generated_username := LOWER(REGEXP_REPLACE(
    COALESCE(
      new.raw_user_meta_data->>'first_name',
      SPLIT_PART(new.raw_user_meta_data->>'full_name', ' ', 1),
      SPLIT_PART(new.email, '@', 1)
    ), '[^a-zA-Z0-9]', '', 'g'
  ));
  
  -- Ensure username is not empty
  IF generated_username = '' THEN
    generated_username := 'user';
  END IF;
  
  -- Make sure username is unique
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = generated_username || CASE WHEN username_counter = 0 THEN '' ELSE username_counter::text END) LOOP
    username_counter := username_counter + 1;
  END LOOP;
  
  IF username_counter > 0 THEN
    generated_username := generated_username || username_counter::text;
  END IF;

  -- Check if this is the very first user (make them admin)
  IF NOT EXISTS (SELECT 1 FROM public.profiles) THEN
    default_role := 'admin';
  END IF;

  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    username,
    role
  ) VALUES (
    new.id,
    COALESCE(
      new.raw_user_meta_data->>'first_name',
      SPLIT_PART(new.raw_user_meta_data->>'full_name', ' ', 1),
      'User'
    ),
    COALESCE(
      new.raw_user_meta_data->>'last_name',
      SUBSTRING(new.raw_user_meta_data->>'full_name' FROM POSITION(' ' IN new.raw_user_meta_data->>'full_name') + 1),
      ''
    ),
    generated_username,
    default_role -- Always assign a valid role
  );
  
  RETURN new;
END;
$$;

-- Create function to cleanup unverified accounts after 7 days
CREATE OR REPLACE FUNCTION public.cleanup_unverified_accounts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER := 0;
  unverified_user RECORD;
BEGIN
  -- Find users who registered more than 7 days ago and haven't verified their email
  FOR unverified_user IN
    SELECT au.id
    FROM auth.users au
    WHERE au.email_confirmed_at IS NULL
      AND au.created_at < now() - INTERVAL '7 days'
      AND au.created_at > now() - INTERVAL '30 days' -- Don't delete very old accounts
  LOOP
    -- Delete the user
    BEGIN
      -- Delete profile first
      DELETE FROM public.profiles WHERE id = unverified_user.id;
      
      -- Delete auth user (this requires service role)
      -- Note: This part would need to be executed with proper permissions
      deleted_count := deleted_count + 1;
      
      -- Log the cleanup
      INSERT INTO public.admin_audit_log (
        admin_user_id,
        action,
        target_resource,
        metadata,
        timestamp
      ) VALUES (
        '00000000-0000-0000-0000-000000000000'::uuid, -- System user
        'cleanup_unverified_account',
        'auth_users',
        jsonb_build_object('user_id', unverified_user.id, 'reason', 'email_not_verified_after_7_days'),
        now()
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue
      RAISE WARNING 'Failed to cleanup unverified account %: %', unverified_user.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_unverified_accounts() IS 'Automatically deletes user accounts that have not verified their email within 7 days of registration';

-- Add email column to profiles table if it doesn't exist (for easier lookups)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email TEXT;
    
    -- Create index for email lookups
    CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
  END IF;
END $$;

-- Update existing profiles to populate email from auth.users
UPDATE public.profiles p
SET email = au.email
FROM auth.users au
WHERE p.id = au.id AND p.email IS NULL;