/**
 * Additive Supabase migration SOURCE for the Admin V2 overview
 * payment-semantics fix. Held as an in-repo source fixture so the
 * intended migration content is version-controlled and testable
 * without applying it to the live database.
 *
 * LIVE APPLICATION HISTORY (verified in production, no local file
 * duplicate is intentional):
 *   • 20260727134427 admin_overview_payment_semantics
 *       — first pass: per-order capture-ever/failed-without-capture
 *         BUT captured_ever was aggregated only within the reporting
 *         window. This caused a captured-before-window order that
 *         emitted a later `failed` recovery/retry event inside the
 *         window to be double-counted as a failure.
 *   • 20260727135118 admin_overview_payment_semantics_cross_window_fix
 *       — final pass: success = captured_in_window; failure =
 *         failed_in_window AND NOT captured_ever(all history) across
 *         any order touched in the window. This is the definition the
 *         source fixture below models byte-for-semantics.
 *
 * The intended future duplicate-migration filename is therefore the
 * cross-window fix (already live). Do NOT create a new executable
 * migration file for this source fixture — it exists only so the
 * repository has a testable, version-controlled record of the applied
 * definition and its metric dictionary.
 */

/**
 * @deprecated Kept for historical reference. The final applied
 * definition is the cross-window fix — see APPLIED_LIVE_MIGRATIONS.
 */
export const ADMIN_OVERVIEW_PAYMENT_SEMANTICS_MIGRATION_FILENAME =
  "20260727135118_admin_overview_payment_semantics_cross_window_fix.sql";

export const APPLIED_LIVE_MIGRATIONS = [
  {
    version: "20260727134427",
    name: "admin_overview_payment_semantics",
    note: "first pass; captured_ever bound to the reporting window (superseded).",
  },
  {
    version: "20260727135118",
    name: "admin_overview_payment_semantics_cross_window_fix",
    note: "final: success=captured_in_window; failure=failed_in_window AND NOT captured_ever(all history).",
  },
] as const;

export const ADMIN_OVERVIEW_PAYMENT_SEMANTICS_SQL = `-- V2 pre-launch hardening: correct payment success/failure semantics on
-- the Admin V2 overview — cross-window final definition.
--
-- METRIC DICTIONARY (payment window = last p_period_days, actor must be
-- an admin, SECURITY DEFINER, SET search_path = ''):
--
--   payment_success_count
--     Distinct orders that received AT LEAST ONE \`captured\` event
--     WITHIN the reporting window. Order-level, capture-in-window.
--
--   payment_failure_count
--     Distinct orders that received AT LEAST ONE \`failed\` event
--     WITHIN the reporting window AND have NO \`captured\` event across
--     the full payment_events history (any time, in or out of window).
--     A capture that landed BEFORE the window still supersedes any
--     later in-window failure signal (retry/recovery), so an order
--     captured outside the window is never counted as a failure.
--
--   payment_success_rate
--     round(100 * success / (success + failure), 1) when the denominator
--     is > 0; otherwise NULL so the UI can render "Unavailable" instead
--     of implying a 0% rate.
--
-- Everything else — signature, admin gate, SECURITY DEFINER hardening,
-- output keys, revenue, entitlements, refunds, downloads, delivery
-- failures, attention block — is preserved byte-for-byte.
--
-- This migration is additive and idempotent (CREATE OR REPLACE) and does
-- not modify historical rows, enums, or grants.

CREATE OR REPLACE FUNCTION public.get_admin_v2_overview(p_period_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_admin boolean;
  v_since timestamptz := now() - make_interval(days => greatest(1, p_period_days));
  v_revenue_fils bigint;
  v_paid_orders int;
  v_failed_orders_period int;
  v_active_entitlements int;
  v_lifetime_purchases int;
  v_lifetime_threshold int;
  v_success_count int;
  v_failure_count int;
  v_success_rate numeric;
  v_refund_count int;
  v_refund_denominator int;
  v_refund_rate numeric;
  v_total_resources int;
  v_published_resources int;
  v_drafts int;
  v_review int;
  v_scans int;
  v_failed_payments int;
  v_pending_refunds int;
  v_open_reports int;
  v_downloads_count int;
  v_downloads_unique_users int;
  v_downloads jsonb;
  v_delivery_failures_count int;
  v_delivery_attempts int;
  v_delivery jsonb;
BEGIN
  SELECT public.has_role(v_actor, 'admin'::public.app_role) INTO v_admin;
  IF NOT v_admin THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(sum(paid_fils),0), count(*)
    INTO v_revenue_fils, v_paid_orders
  FROM public.orders
  WHERE status = 'paid'::public.v2_order_status AND settled_at >= v_since;

  SELECT count(*) INTO v_failed_orders_period
  FROM public.orders WHERE status = 'failed'::public.v2_order_status AND updated_at >= v_since;

  SELECT count(*) INTO v_active_entitlements
  FROM public.entitlements
  WHERE revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());

  SELECT
    count(*) FILTER (WHERE grant_reason = 'lifetime_purchase'::public.v2_grant_reason),
    count(*) FILTER (WHERE grant_reason = 'lifetime_threshold'::public.v2_grant_reason)
  INTO v_lifetime_purchases, v_lifetime_threshold
  FROM public.entitlements
  WHERE scope = 'library'::public.v2_entitlement_scope
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());

  -- Cross-window capture-ever semantics.
  -- Only orders that emitted a captured/failed event WITHIN the window
  -- are considered; captured_ever is computed across ALL history for
  -- those orders. A captured event before the window still supersedes
  -- any in-window failure.
  WITH orders_in_window AS (
    SELECT DISTINCT order_id
    FROM public.payment_events
    WHERE order_id IS NOT NULL
      AND received_at >= v_since
      AND event_type::text IN ('captured','failed')
  ),
  per_order AS (
    SELECT
      o.order_id,
      bool_or(pe.event_type::text = 'captured' AND pe.received_at >= v_since) AS captured_in_window,
      bool_or(pe.event_type::text = 'captured')                               AS captured_ever,
      bool_or(pe.event_type::text = 'failed'   AND pe.received_at >= v_since) AS failed_in_window
    FROM orders_in_window o
    JOIN public.payment_events pe ON pe.order_id = o.order_id
    GROUP BY o.order_id
  )
  SELECT
    count(*) FILTER (WHERE captured_in_window),
    count(*) FILTER (WHERE failed_in_window AND NOT captured_ever)
  INTO v_success_count, v_failure_count
  FROM per_order;

  IF (v_success_count + v_failure_count) > 0 THEN
    v_success_rate := round(100.0 * v_success_count / (v_success_count + v_failure_count), 1);
  END IF;

  SELECT count(*) INTO v_refund_count FROM public.refunds
   WHERE status = 'processed'::public.v2_refund_status
     AND coalesce(processed_at, updated_at) >= v_since;
  v_refund_denominator := v_paid_orders;
  IF v_refund_denominator > 0 THEN
    v_refund_rate := round(100.0 * v_refund_count / v_refund_denominator, 1);
  END IF;

  SELECT count(*), count(*) FILTER (WHERE lifecycle = 'published'::public.v2_resource_lifecycle)
    INTO v_total_resources, v_published_resources FROM public.resources;

  SELECT count(*) FILTER (WHERE lifecycle = 'draft'::public.v2_resource_lifecycle),
         count(*) FILTER (WHERE lifecycle = 'review'::public.v2_resource_lifecycle)
    INTO v_drafts, v_review FROM public.resources;

  SELECT count(DISTINCT r.id) INTO v_scans
  FROM public.resources r
  JOIN public.resource_versions rv ON rv.id = r.current_version_id
  LEFT JOIN LATERAL (
    SELECT status::text AS s
      FROM public.package_scans ps
     WHERE ps.resource_version_id = rv.id
     ORDER BY ps.created_at DESC, ps.scanned_at DESC NULLS LAST
     LIMIT 1
  ) last_scan ON true
  WHERE r.type IN ('skill'::public.v2_resource_type, 'automation'::public.v2_resource_type)
    AND EXISTS (SELECT 1 FROM public.resource_files f WHERE f.resource_version_id = rv.id)
    AND (last_scan.s IS NULL OR last_scan.s <> 'clean');

  SELECT count(*) INTO v_failed_payments
    FROM public.orders WHERE status = 'failed'::public.v2_order_status;
  SELECT count(*) INTO v_pending_refunds
    FROM public.refunds WHERE status = 'pending'::public.v2_refund_status;
  SELECT count(*) INTO v_open_reports
    FROM public.reports WHERE status = 'open'::public.v2_report_status;

  BEGIN
    SELECT count(*), count(DISTINCT actor_user_id)
      INTO v_downloads_count, v_downloads_unique_users
    FROM public.activity_events
    WHERE action = 'download_authorized'
      AND created_at >= v_since;
    v_downloads := jsonb_build_object(
      'available', true,
      'count', coalesce(v_downloads_count, 0),
      'unique_users', coalesce(v_downloads_unique_users, 0)
    );
  EXCEPTION WHEN OTHERS THEN
    v_downloads := jsonb_build_object(
      'available', false,
      'reason', 'download event stream unavailable'
    );
  END;

  BEGIN
    SELECT
      count(*) FILTER (WHERE success = false),
      count(*)
    INTO v_delivery_failures_count, v_delivery_attempts
    FROM public.email_logs
    WHERE attempted_at >= v_since;
    v_delivery := jsonb_build_object(
      'available', true,
      'count', coalesce(v_delivery_failures_count, 0),
      'attempts', coalesce(v_delivery_attempts, 0)
    );
  EXCEPTION WHEN OTHERS THEN
    v_delivery := jsonb_build_object(
      'available', false,
      'reason', 'email delivery events unavailable'
    );
  END;

  RETURN jsonb_build_object(
    'period_days', p_period_days,
    'period_since', v_since,
    'revenue_fils', coalesce(v_revenue_fils,0),
    'paid_orders', v_paid_orders,
    'failed_orders_period', v_failed_orders_period,
    'downloads', v_downloads,
    'active_entitlements', v_active_entitlements,
    'lifetime_purchase_count', v_lifetime_purchases,
    'lifetime_threshold_count', v_lifetime_threshold,
    'payment_success_count', v_success_count,
    'payment_failure_count', v_failure_count,
    'payment_success_rate', v_success_rate,
    'refund_count', v_refund_count,
    'refund_denominator', v_refund_denominator,
    'refund_rate', v_refund_rate,
    'delivery_failures', v_delivery,
    'total_resources', v_total_resources,
    'published_resources', v_published_resources,
    'attention', jsonb_build_object(
      'drafts', v_drafts,
      'review', v_review,
      'scans', v_scans,
      'failed_payments', v_failed_payments,
      'pending_refunds', v_pending_refunds,
      'open_reports', v_open_reports
    )
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_admin_v2_overview(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_v2_overview(int) TO authenticated, service_role;
`;
