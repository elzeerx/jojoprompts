-- Reconcile confirmed legacy Auth users that predate or escaped the
-- on_auth_user_created profile/role trigger.
--
-- This migration is deliberately generic and idempotent:
-- - it never hard-codes user ids,
-- - it inserts profiles only when they are missing,
-- - it preserves every existing role,
-- - it adds the ordinary `user` role only when an account has no role,
-- - it does not grant entitlements or change commerce/access records.

DO $migration$
DECLARE
  v_user record;
  v_full_name text;
  v_first_name text;
  v_last_name text;
  v_username_base text;
  v_username text;
  v_suffix integer;
BEGIN
  FOR v_user IN
    SELECT
      au.id,
      au.email,
      au.created_at,
      au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    WHERE p.id IS NULL
    ORDER BY au.created_at, au.id
  LOOP
    v_full_name := nullif(
      btrim(coalesce(v_user.raw_user_meta_data->>'full_name', '')),
      ''
    );

    v_first_name := coalesce(
      nullif(btrim(v_user.raw_user_meta_data->>'first_name'), ''),
      nullif(btrim(split_part(coalesce(v_full_name, ''), ' ', 1)), ''),
      'User'
    );

    v_last_name := coalesce(
      nullif(btrim(v_user.raw_user_meta_data->>'last_name'), ''),
      CASE
        WHEN position(' ' IN coalesce(v_full_name, '')) > 0
          THEN btrim(
            substring(
              v_full_name
              FROM position(' ' IN v_full_name) + 1
            )
          )
        ELSE NULL
      END,
      ''
    );

    v_username_base := lower(
      regexp_replace(
        coalesce(
          nullif(v_first_name, ''),
          nullif(split_part(coalesce(v_user.email, ''), '@', 1), ''),
          'user'
        ),
        '[^a-z0-9]',
        '',
        'g'
      )
    );

    IF v_username_base = '' THEN
      v_username_base := 'user';
    END IF;

    v_username := v_username_base;
    v_suffix := 0;

    WHILE EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.username = v_username
        AND p.id <> v_user.id
    )
    LOOP
      v_suffix := v_suffix + 1;
      v_username := v_username_base || v_suffix::text;
    END LOOP;

    INSERT INTO public.profiles (
      id,
      created_at,
      first_name,
      last_name,
      username,
      email
    )
    VALUES (
      v_user.id,
      v_user.created_at,
      v_first_name,
      v_last_name,
      v_username,
      v_user.email
    )
    ON CONFLICT (id) DO NOTHING;

    IF NOT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = v_user.id
    ) THEN
      INSERT INTO public.user_roles (
        user_id,
        role,
        assigned_at,
        is_super_admin
      )
      VALUES (
        v_user.id,
        'user',
        v_user.created_at,
        false
      )
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    WHERE p.id IS NULL
  ) THEN
    RAISE EXCEPTION 'auth_profile_reconciliation_incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    LEFT JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE ur.user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'profile_role_reconciliation_incomplete';
  END IF;
END;
$migration$;
