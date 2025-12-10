-- Fix search_path for the new functions to address security warnings
CREATE OR REPLACE FUNCTION update_abandoned_cart_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION create_abandoned_cart_sequence()
RETURNS TRIGGER AS $$
DECLARE
  v_user_email TEXT;
  v_user_name TEXT;
  v_plan_name TEXT;
  v_plan_price NUMERIC;
BEGIN
  -- Only trigger for new pending transactions
  IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR OLD.status != 'pending') THEN
    -- Get user details
    SELECT email, COALESCE(first_name, username) INTO v_user_email, v_user_name
    FROM public.profiles WHERE id = NEW.user_id;
    
    -- Get plan details
    SELECT name, COALESCE(price_usd, 0) INTO v_plan_name, v_plan_price
    FROM public.subscription_plans WHERE id::text = NEW.plan_id;
    
    -- Only create if user email exists and no active sequence for this transaction
    IF v_user_email IS NOT NULL THEN
      INSERT INTO public.abandoned_cart_sequences (
        user_id, transaction_id, plan_id, plan_name, plan_price,
        user_email, user_name, next_email_scheduled_at
      )
      VALUES (
        NEW.user_id, NEW.id, NEW.plan_id, v_plan_name, v_plan_price,
        v_user_email, v_user_name, now() + interval '2 hours'
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  -- Mark sequence as converted when transaction completes
  IF NEW.status = 'completed' AND (TG_OP = 'UPDATE' AND OLD.status != 'completed') THEN
    UPDATE public.abandoned_cart_sequences 
    SET status = 'converted', conversion_date = now()
    WHERE transaction_id = NEW.id AND status = 'active';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;