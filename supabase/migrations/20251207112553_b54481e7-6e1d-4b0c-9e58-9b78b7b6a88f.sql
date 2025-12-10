-- Drop the obsolete trigger that references the non-existent role column
DROP TRIGGER IF EXISTS trg_prevent_role_change ON public.profiles;

-- Drop the obsolete function
DROP FUNCTION IF EXISTS public.prevent_role_change();

-- Note: Role security is now handled via the user_roles table and RLS policies,
-- so this trigger is no longer needed. The security model has migrated from
-- profiles.role to a separate user_roles table with its own RLS policies.