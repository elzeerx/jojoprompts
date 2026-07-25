-- Phase 6E5: Roles operational hardening (revocations + guard + audit trigger)

-- 1. REVOKE dangerous defaults on admin-only server RPCs.
REVOKE ALL ON FUNCTION public.admin_delete_user_data(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_user_data(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.admin_delete_user_data(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user_data(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.admin_delete_user_data(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_user_data(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user_data(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.admin_create_user(text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_create_user(text, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.admin_change_user_password(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_change_user_password(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_change_user_password(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_change_user_password(uuid, text) TO service_role;

-- 2. Guard: prevent removing or changing away the final admin role.
CREATE OR REPLACE FUNCTION private.tg_user_roles_protect_last_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_count integer;
  v_was_admin boolean;
  v_still_admin boolean;
BEGIN
  -- Advisory lock so concurrent removals cannot both pass.
  PERFORM pg_advisory_xact_lock(hashtext('private.user_roles.protect_last_admin'));

  IF TG_OP = 'DELETE' THEN
    v_was_admin := (OLD.role = 'admin'::public.app_role);
    v_still_admin := false;
  ELSIF TG_OP = 'UPDATE' THEN
    v_was_admin := (OLD.role = 'admin'::public.app_role);
    v_still_admin := (NEW.role = 'admin'::public.app_role);
  ELSE
    RETURN NULL;
  END IF;

  IF v_was_admin AND NOT v_still_admin THEN
    SELECT COUNT(*) INTO v_admin_count
      FROM public.user_roles
      WHERE role = 'admin'::public.app_role
        AND id <> OLD.id;

    IF v_admin_count = 0 THEN
      RAISE EXCEPTION 'Cannot remove or change the last remaining admin role'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.tg_user_roles_protect_last_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.tg_user_roles_protect_last_admin() FROM anon;
REVOKE ALL ON FUNCTION private.tg_user_roles_protect_last_admin() FROM authenticated;

DROP TRIGGER IF EXISTS trg_user_roles_protect_last_admin ON public.user_roles;
CREATE TRIGGER trg_user_roles_protect_last_admin
BEFORE DELETE OR UPDATE OF role ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION private.tg_user_roles_protect_last_admin();

-- 3. Activity log trigger for role assignments/removals.
CREATE OR REPLACE FUNCTION private.tg_user_roles_log_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_action text;
  v_user_id uuid;
  v_role public.app_role;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'role_assigned';
    v_user_id := NEW.user_id;
    v_role := NEW.role;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'role_removed';
    v_user_id := OLD.user_id;
    v_role := OLD.role;
  ELSE
    RETURN NULL;
  END IF;

  INSERT INTO public.activity_events (
    actor_user_id, actor_type, entity_type, entity_id, action, metadata
  ) VALUES (
    auth.uid(),
    'admin',
    'user',
    v_user_id,
    v_action,
    jsonb_build_object('role', v_role::text)
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.tg_user_roles_log_activity() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.tg_user_roles_log_activity() FROM anon;
REVOKE ALL ON FUNCTION private.tg_user_roles_log_activity() FROM authenticated;

DROP TRIGGER IF EXISTS trg_user_roles_log_activity ON public.user_roles;
CREATE TRIGGER trg_user_roles_log_activity
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION private.tg_user_roles_log_activity();
