-- Phase 6E5 corrective: audit role UPDATE operations as well as INSERT/DELETE.
-- Trigger function is SECURITY DEFINER with an empty search_path and is not
-- executable by PUBLIC/anon/authenticated; only fires via the trigger.

CREATE OR REPLACE FUNCTION private.tg_user_roles_log_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_events (
      actor_user_id, actor_type, entity_type, entity_id, action, metadata
    ) VALUES (
      auth.uid(), 'admin', 'user', NEW.user_id, 'role_assigned',
      jsonb_build_object('role', NEW.role::text)
    );
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.activity_events (
      actor_user_id, actor_type, entity_type, entity_id, action, metadata
    ) VALUES (
      auth.uid(), 'admin', 'user', OLD.user_id, 'role_removed',
      jsonb_build_object('role', OLD.role::text)
    );
    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    -- No-op when the role is unchanged (e.g. touching only metadata).
    IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.activity_events (
      actor_user_id, actor_type, entity_type, entity_id, action, metadata
    ) VALUES (
      auth.uid(), 'admin', 'user', OLD.user_id, 'role_removed',
      jsonb_build_object('role', OLD.role::text)
    );
    INSERT INTO public.activity_events (
      actor_user_id, actor_type, entity_type, entity_id, action, metadata
    ) VALUES (
      auth.uid(), 'admin', 'user', NEW.user_id, 'role_assigned',
      jsonb_build_object('role', NEW.role::text)
    );
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.tg_user_roles_log_activity() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.tg_user_roles_log_activity() FROM anon;
REVOKE ALL ON FUNCTION private.tg_user_roles_log_activity() FROM authenticated;

DROP TRIGGER IF EXISTS trg_user_roles_log_activity ON public.user_roles;
CREATE TRIGGER trg_user_roles_log_activity
AFTER INSERT OR DELETE OR UPDATE OF role ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION private.tg_user_roles_log_activity();
