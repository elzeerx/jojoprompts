
-- =========================================================================
-- v2_admin_list_activity_events / v2_admin_get_activity_event
-- Read-only admin RPCs over public.activity_events. Admin-gated. No schema
-- changes. No writes. Reuses public._v2_bounded_limit and public._v2_mask_email.
-- =========================================================================

DROP FUNCTION IF EXISTS public.v2_admin_list_activity_events(text[],text[],text[],uuid,uuid,text,timestamptz,timestamptz,int,int);
CREATE OR REPLACE FUNCTION public.v2_admin_list_activity_events(
  p_actor_types  text[]       DEFAULT NULL,
  p_entity_types text[]       DEFAULT NULL,
  p_actions      text[]       DEFAULT NULL,
  p_actor_user_id uuid        DEFAULT NULL,
  p_entity_id    uuid         DEFAULT NULL,
  p_search       text         DEFAULT NULL,
  p_from         timestamptz  DEFAULT NULL,
  p_to           timestamptz  DEFAULT NULL,
  p_limit        int          DEFAULT 50,
  p_offset       int          DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
  v_limit int;
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
  v_total bigint;
  v_rows jsonb;
  v_search text := NULLIF(trim(coalesce(p_search,'')), '');
BEGIN
  v_actor := public._v2_require_admin();
  v_limit := public._v2_bounded_limit(p_limit, 200);

  WITH filt AS (
    SELECT e.*, p.email AS actor_email, p.username AS actor_username
    FROM public.activity_events e
    LEFT JOIN public.profiles p ON p.id = e.actor_user_id
    WHERE (p_actor_types  IS NULL OR e.actor_type   = ANY(p_actor_types))
      AND (p_entity_types IS NULL OR e.entity_type  = ANY(p_entity_types))
      AND (p_actions      IS NULL OR e.action       = ANY(p_actions))
      AND (p_actor_user_id IS NULL OR e.actor_user_id = p_actor_user_id)
      AND (p_entity_id    IS NULL OR e.entity_id    = p_entity_id)
      AND (p_from         IS NULL OR e.created_at  >= p_from)
      AND (p_to           IS NULL OR e.created_at  <  p_to)
      AND (
        v_search IS NULL
        OR e.action      ILIKE '%'||v_search||'%'
        OR e.entity_type ILIKE '%'||v_search||'%'
      )
  ), counted AS (
    SELECT COUNT(*) AS c FROM filt
  ), page AS (
    SELECT * FROM filt
    ORDER BY created_at DESC, id DESC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT (SELECT c FROM counted),
         COALESCE(jsonb_agg(jsonb_build_object(
           'id',                  p.id,
           'created_at',          p.created_at,
           'actor_user_id',       p.actor_user_id,
           'actor_type',          p.actor_type,
           'actor_email_masked',  public._v2_mask_email(p.actor_email),
           'actor_username',      p.actor_username,
           'entity_type',         p.entity_type,
           'entity_id',           p.entity_id,
           'action',              p.action,
           'ip_address',          p.ip_address,
           'metadata_preview',    CASE
             WHEN p.metadata IS NULL OR p.metadata = '{}'::jsonb THEN NULL
             ELSE left(p.metadata::text, 240)
           END
         ) ORDER BY p.created_at DESC, p.id DESC), '[]'::jsonb)
  INTO v_total, v_rows
  FROM page p;

  RETURN jsonb_build_object(
    'total_count', v_total,
    'rows',        v_rows,
    'limit',       v_limit,
    'offset',      v_offset
  );
END
$$;
REVOKE ALL ON FUNCTION public.v2_admin_list_activity_events(text[],text[],text[],uuid,uuid,text,timestamptz,timestamptz,int,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_admin_list_activity_events(text[],text[],text[],uuid,uuid,text,timestamptz,timestamptz,int,int) TO authenticated;

-- =========================================================================
DROP FUNCTION IF EXISTS public.v2_admin_get_activity_event(uuid);
CREATE OR REPLACE FUNCTION public.v2_admin_get_activity_event(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
  v_row jsonb;
BEGIN
  v_actor := public._v2_require_admin();

  SELECT jsonb_build_object(
           'id',                  e.id,
           'created_at',          e.created_at,
           'actor_user_id',       e.actor_user_id,
           'actor_type',          e.actor_type,
           'actor_email_masked',  public._v2_mask_email(p.email),
           'actor_username',      p.username,
           'entity_type',         e.entity_type,
           'entity_id',           e.entity_id,
           'action',              e.action,
           'ip_address',          e.ip_address,
           'metadata',            e.metadata
         )
  INTO v_row
  FROM public.activity_events e
  LEFT JOIN public.profiles p ON p.id = e.actor_user_id
  WHERE e.id = p_id;

  IF v_row IS NULL THEN
    RAISE EXCEPTION 'event_not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_row;
END
$$;
REVOKE ALL ON FUNCTION public.v2_admin_get_activity_event(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_admin_get_activity_event(uuid) TO authenticated;
