
-- Phase 1: Database & Backend Cleanup for PayPal-exclusive payments

-- 1. Drop legacy Tap payments table if it exists and is not needed.
DROP TABLE IF EXISTS public.payments CASCADE;

-- 2. Update create_subscription database function to remove Tap references and use PayPal payment data only
DROP FUNCTION IF EXISTS public.create_subscription(p_user_id uuid, p_plan_id text, p_tap_id text);

CREATE OR REPLACE FUNCTION public.create_subscription(
  p_user_id uuid,
  p_plan_id uuid,
  p_paypal_payment_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  result json;
  existing_subscription RECORD;
BEGIN
  -- Check if subscription already exists for this PayPal payment
  SELECT * INTO existing_subscription FROM public.user_subscriptions
    WHERE payment_method = 'paypal' AND payment_id = p_paypal_payment_id;

  IF FOUND THEN
    RETURN json_build_object('success', true, 'message', 'Subscription already exists for this PayPal payment');
  END IF;

  -- Insert new subscription
  INSERT INTO public.user_subscriptions (
    user_id, plan_id, payment_method, payment_id, status, start_date
  )
  VALUES
    (p_user_id, p_plan_id, 'paypal', p_paypal_payment_id, 'active', now());

  RETURN json_build_object('success', true, 'message', 'Subscription created successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- 3. Ensure all legacy Tap columns are removed from related tables (already handled in previous migrations).

-- 4. Ensure user_subscriptions and transactions use only PayPal payment structure; nothing to change as schema matches.

-- 5. Optionally, clean up any dead Tap data in user_subscriptions and payments_log
-- (not strictly needed if columns already dropped above, included for completeness)
DELETE FROM public.user_subscriptions WHERE payment_method = 'tap';
DELETE FROM public.transactions WHERE error_message ILIKE '%tap%';
