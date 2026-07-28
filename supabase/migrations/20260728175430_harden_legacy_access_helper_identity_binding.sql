-- Harden legacy SECURITY DEFINER access helpers against cross-account probes.
--
-- These functions must remain executable from RLS policies and the existing
-- Edge Function authorization paths, so revoking browser execution outright
-- would break legitimate traffic. Instead, every user-id parameter is bound
-- to the JWT subject unless the caller is an admin or a trusted server
-- context. Anonymous callers may still execute the two RLS helpers, but they
-- can no longer use an arbitrary UUID to enumerate roles or staff access.
--
-- Trusted server contexts:
--   * a service_role JWT; or
--   * a direct postgres/service_role database session.
--
-- All table references are schema-qualified and every function has a pinned,
-- empty search_path.

CREATE OR REPLACE FUNCTION public.has_role(
  _user_id uuid,
  _role public.app_role
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_trusted_server boolean :=
    COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
    OR session_user IN ('postgres', 'service_role');
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  IF v_actor IS NULL THEN
    IF NOT v_trusted_server THEN
      RETURN false;
    END IF;
  ELSIF _user_id IS DISTINCT FROM v_actor
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_roles actor_role
      WHERE actor_role.user_id = v_actor
        AND actor_role.role = 'admin'::public.app_role
    )
  THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles target_role
    WHERE target_role.user_id = _user_id
      AND target_role.role = _role
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_prompts(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_trusted_server boolean :=
    COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
    OR session_user IN ('postgres', 'service_role');
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  IF v_actor IS NULL THEN
    IF NOT v_trusted_server THEN
      RETURN false;
    END IF;
  ELSIF _user_id IS DISTINCT FROM v_actor
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_roles actor_role
      WHERE actor_role.user_id = v_actor
        AND actor_role.role = 'admin'::public.app_role
    )
  THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles target_role
    WHERE target_role.user_id = _user_id
      AND target_role.role IN (
        'admin'::public.app_role,
        'prompter'::public.app_role,
        'jadmin'::public.app_role
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_subscription_tier(
  user_id_param uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_subject uuid := user_id_param;
  v_user_tier text;
  v_trusted_server boolean :=
    COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
    OR session_user IN ('postgres', 'service_role');
BEGIN
  IF v_actor IS NULL THEN
    IF NOT v_trusted_server THEN
      RETURN 'free';
    END IF;
  ELSE
    IF v_subject IS NULL THEN
      v_subject := v_actor;
    ELSIF v_subject IS DISTINCT FROM v_actor
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_roles actor_role
        WHERE actor_role.user_id = v_actor
          AND actor_role.role = 'admin'::public.app_role
      )
    THEN
      v_subject := v_actor;
    END IF;
  END IF;

  IF v_subject IS NULL THEN
    RETURN 'free';
  END IF;

  SELECT subscription_plan.tier
  INTO v_user_tier
  FROM public.user_subscriptions user_subscription
  JOIN public.subscription_plans subscription_plan
    ON subscription_plan.id = user_subscription.plan_id
  WHERE user_subscription.user_id = v_subject
    AND user_subscription.status = 'active'
    AND (
      user_subscription.end_date IS NULL
      OR user_subscription.end_date > now()
    )
  ORDER BY CASE subscription_plan.tier
    WHEN 'ultimate' THEN 4
    WHEN 'premium' THEN 3
    WHEN 'standard' THEN 2
    WHEN 'basic' THEN 1
    ELSE 0
  END DESC
  LIMIT 1;

  RETURN COALESCE(v_user_tier, 'free');
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_tier(
  user_id_param uuid,
  required_tier text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_subject uuid := user_id_param;
  v_user_tier text;
  v_user_tier_level integer;
  v_required_tier_level integer;
  v_trusted_server boolean :=
    COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
    OR session_user IN ('postgres', 'service_role');
BEGIN
  IF v_actor IS NULL THEN
    IF NOT v_trusted_server THEN
      RETURN false;
    END IF;
  ELSE
    IF v_subject IS NULL THEN
      v_subject := v_actor;
    ELSIF v_subject IS DISTINCT FROM v_actor
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_roles actor_role
        WHERE actor_role.user_id = v_actor
          AND actor_role.role = 'admin'::public.app_role
      )
    THEN
      v_subject := v_actor;
    END IF;
  END IF;

  IF v_subject IS NULL THEN
    RETURN false;
  END IF;

  IF public.has_role(v_subject, 'admin'::public.app_role)
    OR public.has_role(v_subject, 'jadmin'::public.app_role)
    OR public.has_role(v_subject, 'prompter'::public.app_role)
  THEN
    RETURN true;
  END IF;

  v_user_tier := public.get_user_subscription_tier(v_subject);
  v_user_tier_level := CASE v_user_tier
    WHEN 'ultimate' THEN 4
    WHEN 'premium' THEN 3
    WHEN 'standard' THEN 2
    WHEN 'basic' THEN 1
    ELSE 0
  END;
  v_required_tier_level := CASE COALESCE(required_tier, 'basic')
    WHEN 'premium' THEN 3
    WHEN 'standard' THEN 2
    WHEN 'basic' THEN 1
    ELSE 1
  END;

  RETURN v_user_tier_level >= v_required_tier_level;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_prompt(
  user_id_param uuid,
  prompt_id_param uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_subject uuid := user_id_param;
  v_prompt_category text;
  v_required_tier text;
  v_trusted_server boolean :=
    COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
    OR session_user IN ('postgres', 'service_role');
BEGIN
  IF v_actor IS NULL THEN
    IF NOT v_trusted_server THEN
      RETURN false;
    END IF;
  ELSE
    IF v_subject IS NULL THEN
      v_subject := v_actor;
    ELSIF v_subject IS DISTINCT FROM v_actor
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_roles actor_role
        WHERE actor_role.user_id = v_actor
          AND actor_role.role = 'admin'::public.app_role
      )
    THEN
      v_subject := v_actor;
    END IF;
  END IF;

  IF v_subject IS NULL OR prompt_id_param IS NULL THEN
    RETURN false;
  END IF;

  SELECT prompt.metadata ->> 'category'
  INTO v_prompt_category
  FROM public.prompts prompt
  WHERE prompt.id = prompt_id_param;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_prompt_category IS NULL THEN
    RETURN true;
  END IF;

  SELECT category.required_plan
  INTO v_required_tier
  FROM public.categories category
  WHERE category.name = v_prompt_category;

  IF v_required_tier IS NULL THEN
    RETURN true;
  END IF;

  RETURN public.can_access_tier(v_subject, v_required_tier);
END;
$$;

CREATE OR REPLACE FUNCTION public.user_has_active_subscription(
  check_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_subject uuid := check_user_id;
  v_trusted_server boolean :=
    COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
    OR session_user IN ('postgres', 'service_role');
BEGIN
  IF v_actor IS NULL THEN
    IF NOT v_trusted_server THEN
      RETURN false;
    END IF;
  ELSE
    IF v_subject IS NULL THEN
      v_subject := v_actor;
    ELSIF v_subject IS DISTINCT FROM v_actor
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_roles actor_role
        WHERE actor_role.user_id = v_actor
          AND actor_role.role = 'admin'::public.app_role
      )
    THEN
      v_subject := v_actor;
    END IF;
  END IF;

  IF v_subject IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_subscriptions user_subscription
    JOIN public.subscription_plans subscription_plan
      ON subscription_plan.id = user_subscription.plan_id
    WHERE user_subscription.user_id = v_subject
      AND user_subscription.status IN ('active', 'trial')
      AND (
        user_subscription.end_date IS NULL
        OR user_subscription.end_date > now()
      )
  );
END;
$$;

-- Preserve the narrow execution matrix after CREATE OR REPLACE.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)
  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_manage_prompts(uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_prompts(uuid)
  TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_user_subscription_tier(uuid)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_tier(uuid, text)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_prompt(uuid, uuid)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_has_active_subscription(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_user_subscription_tier(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_tier(uuid, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_prompt(uuid, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_active_subscription(uuid)
  TO authenticated, service_role;
