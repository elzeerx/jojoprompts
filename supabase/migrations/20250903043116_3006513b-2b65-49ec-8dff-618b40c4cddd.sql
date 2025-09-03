
-- 1) Ensure RLS is enabled and enforced on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- 2) Drop all existing policies on public.profiles to avoid conflicts
DO $$
DECLARE 
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

-- 3) Recreate minimal, safe policies using a SECURITY DEFINER helper

-- SELECT: owner or any admin can read profiles
CREATE POLICY "profiles_select_owner_or_admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR public.is_admin()
);

-- INSERT: self or admin can insert a profile row
CREATE POLICY "profiles_insert_self_or_admin"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id
  OR public.is_admin()
);

-- UPDATE: owner or admin can update; ensure row remains valid post-update
CREATE POLICY "profiles_update_owner_or_admin"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = id
  OR public.is_admin()
)
WITH CHECK (
  auth.uid() = id
  OR public.is_admin()
);

-- DELETE: owner or admin can delete
CREATE POLICY "profiles_delete_owner_or_admin"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  auth.uid() = id
  OR public.is_admin()
);
