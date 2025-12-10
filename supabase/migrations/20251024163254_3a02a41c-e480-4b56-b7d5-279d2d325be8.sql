-- Drop the old trigger and function with CASCADE
DROP FUNCTION IF EXISTS public.sync_profile_role() CASCADE;

-- STEP 1: Add super admin flag to user_roles table
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

-- STEP 2: Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_super_admin 
ON public.user_roles(user_id) WHERE is_super_admin = true;

-- STEP 3: Set current super admin (nawaf@elzeer.com)
UPDATE public.user_roles
SET is_super_admin = true
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'nawaf@elzeer.com'
) AND role = 'admin';

-- STEP 4: Create helper function to check super admin status
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
    AND is_super_admin = true
  );
$$;

COMMENT ON FUNCTION public.is_super_admin IS 'Check if user is a super admin with full system access';