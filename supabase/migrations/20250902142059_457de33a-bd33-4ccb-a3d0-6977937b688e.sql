-- First, drop all existing policies on profiles table
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile (no role change)" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "read_own_profile" ON public.profiles;

-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create new restrictive policies

-- Allow profile owner or admin to read any row
CREATE POLICY "Allow owner or admin to read profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id
  OR EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

-- Allow owner or admin to update/delete profile
CREATE POLICY "Allow owner or admin to update profiles"
ON public.profiles
FOR UPDATE
USING (
  auth.uid() = id
  OR EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

CREATE POLICY "Allow owner or admin to delete profiles"
ON public.profiles
FOR DELETE
USING (
  auth.uid() = id
  OR EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

-- User can insert only their own profile (or admin can insert any)
CREATE POLICY "Allow self or admin to insert profile"
ON public.profiles
FOR INSERT
WITH CHECK (
  auth.uid() = id
  OR EXISTS (
    SELECT 1 FROM public.profiles AS p WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);