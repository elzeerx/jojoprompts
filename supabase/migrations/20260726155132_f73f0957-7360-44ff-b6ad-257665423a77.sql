CREATE OR REPLACE FUNCTION public.v2_internal_admin_roles_settings_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total_assignments         bigint := 0;
  v_users_with_roles          bigint := 0;
  v_admin_count               bigint := 0;
  v_jadmin_count              bigint := 0;
  v_prompter_count            bigint := 0;
  v_user_count                bigint := 0;
  v_super_admin_count         bigint := 0;
  v_users_with_multiple_roles bigint := 0;
  v_auth_users_total          bigint := 0;
  v_auth_users_without_roles  bigint := 0;
  v_profiles_total            bigint := 0;
  v_profiles_without_roles    bigint := 0;
  v_last_assigned_at          timestamptz;
  v_rls_enabled               boolean := false;
  v_unique_constraint         boolean := false;
BEGIN
  SELECT count(*) INTO v_total_assignments FROM public.user_roles;
  SELECT count(DISTINCT user_id) INTO v_users_with_roles FROM public.user_roles;

  SELECT count(*) FILTER (WHERE role = 'admin'::public.app_role),
         count(*) FILTER (WHERE role = 'jadmin'::public.app_role),
         count(*) FILTER (WHERE role = 'prompter'::public.app_role),
         count(*) FILTER (WHERE role = 'user'::public.app_role),
         count(*) FILTER (WHERE is_super_admin IS TRUE),
         max(assigned_at)
    INTO v_admin_count, v_jadmin_count, v_prompter_count, v_user_count,
         v_super_admin_count, v_last_assigned_at
  FROM public.user_roles;

  SELECT count(*) INTO v_users_with_multiple_roles
  FROM (
    SELECT user_id
    FROM public.user_roles
    GROUP BY user_id
    HAVING count(*) > 1
  ) x;

  SELECT count(*) INTO v_auth_users_total FROM auth.users;
  SELECT count(*) INTO v_auth_users_without_roles
  FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id
  );

  SELECT count(*) INTO v_profiles_total FROM public.profiles;
  SELECT count(*) INTO v_profiles_without_roles
  FROM public.profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id
  );

  SELECT c.relrowsecurity INTO v_rls_enabled
  FROM pg_class c
  WHERE c.oid = 'public.user_roles'::regclass;
  v_rls_enabled := coalesce(v_rls_enabled, false);

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a1 ON a1.attrelid = c.oid AND a1.attnum = con.conkey[1]
    JOIN pg_attribute a2 ON a2.attrelid = c.oid AND a2.attnum = con.conkey[2]
    WHERE n.nspname = 'public'
      AND c.relname = 'user_roles'
      AND con.contype = 'u'
      AND cardinality(con.conkey) = 2
      AND (
        (a1.attname = 'user_id' AND a2.attname = 'role') OR
        (a1.attname = 'role' AND a2.attname = 'user_id')
      )
  ) INTO v_unique_constraint;

  RETURN jsonb_build_object(
    'as_of', now(),
    'total_assignments', v_total_assignments,
    'users_with_roles', v_users_with_roles,
    'role_counts', jsonb_build_object(
      'admin', v_admin_count,
      'jadmin', v_jadmin_count,
      'prompter', v_prompter_count,
      'user', v_user_count
    ),
    'super_admin_count', v_super_admin_count,
    'users_with_multiple_roles', v_users_with_multiple_roles,
    'auth_users_total', v_auth_users_total,
    'auth_users_without_roles', v_auth_users_without_roles,
    'profiles_total', v_profiles_total,
    'profiles_without_roles', v_profiles_without_roles,
    'last_assigned_at', v_last_assigned_at,
    'rls_enabled', v_rls_enabled,
    'unique_user_role_constraint', v_unique_constraint
  );
END;
$$;

REVOKE ALL ON FUNCTION public.v2_internal_admin_roles_settings_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.v2_internal_admin_roles_settings_summary() FROM anon;
REVOKE ALL ON FUNCTION public.v2_internal_admin_roles_settings_summary() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.v2_internal_admin_roles_settings_summary() TO service_role;