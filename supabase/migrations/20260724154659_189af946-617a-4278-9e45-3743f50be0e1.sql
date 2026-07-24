CREATE OR REPLACE FUNCTION public.v2_submit_resource_report(
  p_resource_id uuid,
  p_category    text,
  p_details     text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_category  text;
  v_details   text;
  v_hash      text;
  v_limit     jsonb;
  v_row_id    uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;
  IF p_resource_id IS NULL THEN
    RAISE EXCEPTION 'invalid_resource';
  END IF;
  v_category := lower(trim(coalesce(p_category, '')));
  IF v_category NOT IN ('copyright','harmful','inappropriate','spam','malware','other') THEN
    RAISE EXCEPTION 'invalid_category';
  END IF;
  v_details := nullif(trim(coalesce(p_details, '')), '');
  IF v_details IS NOT NULL AND length(v_details) > 2000 THEN
    RAISE EXCEPTION 'details_too_long';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.resources WHERE id = p_resource_id) THEN
    RAISE EXCEPTION 'unknown_resource';
  END IF;
  v_hash := md5('report-submit:' || v_uid::text);
  BEGIN
    v_limit := public.check_contact_submission_rate_limit(v_hash, 'user', 5, 3600);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'rate_limit_unavailable' USING ERRCODE = '54000';
  END;
  IF NOT coalesce((v_limit->>'allowed')::boolean, false) THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = '54000';
  END IF;
  INSERT INTO public.reports (reporter_user_id, resource_id, category, details, status)
  VALUES (v_uid, p_resource_id, v_category, v_details, 'open'::public.v2_report_status)
  RETURNING id INTO v_row_id;
  RETURN jsonb_build_object('ok', true, 'report_id', v_row_id);
END;
$$;

REVOKE ALL ON FUNCTION public.v2_submit_resource_report(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.v2_submit_resource_report(uuid, text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.v2_submit_resource_report(uuid, text, text) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.v2_submit_resource_report(uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.v2_admin_list_reports(
  p_status text[] DEFAULT NULL,
  p_search text   DEFAULT NULL,
  p_limit  int    DEFAULT 50,
  p_offset int    DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_limit  int  := LEAST(GREATEST(coalesce(p_limit, 50), 1), 200);
  v_offset int  := GREATEST(coalesce(p_offset, 0), 0);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_status text[];
  v_total  bigint;
  v_rows   jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NOT NULL THEN
    SELECT array_agg(s) INTO v_status
    FROM unnest(p_status) AS s
    WHERE s IN ('open','reviewing','resolved','dismissed');
  END IF;

  SELECT count(*) INTO v_total
  FROM public.reports r
  LEFT JOIN public.resources res ON res.id = r.resource_id
  WHERE (v_status IS NULL OR r.status::text = ANY(v_status))
    AND (
      v_search IS NULL
      OR res.slug ILIKE '%' || v_search || '%'
      OR res.title_en ILIKE '%' || v_search || '%'
      OR res.title_ar ILIKE '%' || v_search || '%'
    );

  SELECT coalesce(jsonb_agg(row), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'id',            r.id,
      'status',        r.status,
      'category',      r.category,
      'details',       r.details,
      'created_at',    r.created_at,
      'updated_at',    r.updated_at,
      'resolved_at',   r.resolved_at,
      'resolver_notes',r.resolver_notes,
      'resource_id',   r.resource_id,
      'resource_slug', res.slug,
      'resource_title',coalesce(res.title_en, res.title_ar),
      'reporter_user_id', r.reporter_user_id,
      'reporter_email_masked',
        CASE
          WHEN p.email IS NULL THEN NULL
          WHEN position('@' in p.email) = 0 THEN '***'
          ELSE substr(p.email, 1, 1) || '***@' || split_part(p.email, '@', 2)
        END
    ) AS row
    FROM public.reports r
    LEFT JOIN public.resources res ON res.id = r.resource_id
    LEFT JOIN public.profiles  p   ON p.id   = r.reporter_user_id
    WHERE (v_status IS NULL OR r.status::text = ANY(v_status))
      AND (
        v_search IS NULL
        OR res.slug ILIKE '%' || v_search || '%'
        OR res.title_en ILIKE '%' || v_search || '%'
        OR res.title_ar ILIKE '%' || v_search || '%'
      )
    ORDER BY r.created_at DESC
    LIMIT v_limit OFFSET v_offset
  ) t;

  RETURN jsonb_build_object(
    'total_count', v_total,
    'limit',       v_limit,
    'offset',      v_offset,
    'rows',        v_rows
  );
END;
$$;

REVOKE ALL ON FUNCTION public.v2_admin_list_reports(text[], text, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.v2_admin_list_reports(text[], text, int, int) FROM anon;
GRANT  EXECUTE ON FUNCTION public.v2_admin_list_reports(text[], text, int, int) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.v2_admin_list_reports(text[], text, int, int) TO service_role;

CREATE OR REPLACE FUNCTION public.v2_admin_update_report_status(
  p_report_id   uuid,
  p_next_status text,
  p_notes       text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_row   public.reports;
  v_next  public.v2_report_status;
  v_notes text;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;
  IF p_report_id IS NULL THEN
    RAISE EXCEPTION 'invalid_report';
  END IF;
  IF p_next_status NOT IN ('open','reviewing','resolved','dismissed') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;
  v_next := p_next_status::public.v2_report_status;
  v_notes := nullif(trim(coalesce(p_notes, '')), '');
  IF v_notes IS NOT NULL AND length(v_notes) > 2000 THEN
    RAISE EXCEPTION 'notes_too_long';
  END IF;

  UPDATE public.reports
     SET status         = v_next,
         resolver_notes = coalesce(v_notes, resolver_notes),
         resolved_at    = CASE WHEN v_next IN ('resolved','dismissed') THEN now() ELSE NULL END,
         updated_at     = now()
   WHERE id = p_report_id
   RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown_report';
  END IF;

  INSERT INTO public.activity_events (actor_user_id, actor_type, entity_type, entity_id, action, metadata)
  VALUES (v_uid, 'admin', 'report', v_row.id, 'report.status_changed',
          jsonb_build_object('to', v_next::text, 'notes_present', v_notes IS NOT NULL));

  RETURN jsonb_build_object('ok', true, 'report_id', v_row.id, 'status', v_next::text);
END;
$$;

REVOKE ALL ON FUNCTION public.v2_admin_update_report_status(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.v2_admin_update_report_status(uuid, text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.v2_admin_update_report_status(uuid, text, text) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.v2_admin_update_report_status(uuid, text, text) TO service_role;