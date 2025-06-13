
-- Phase 1: Database Schema Updates
-- Remove Tap-specific columns and add PayPal-specific columns to payments table
ALTER TABLE public.payments DROP COLUMN IF EXISTS tap_charge_id;
ALTER TABLE public.payments DROP COLUMN IF EXISTS tap_reference;

-- Add PayPal-specific columns
ALTER TABLE public.payments ADD COLUMN paypal_payment_id TEXT;
ALTER TABLE public.payments ADD COLUMN paypal_payer_id TEXT;
ALTER TABLE public.payments ADD COLUMN paypal_order_id TEXT;

-- Update subscriptions table to use PayPal instead of Tap
ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS tap_charge;
ALTER TABLE public.subscriptions ADD COLUMN paypal_payment_id TEXT;

-- Update payments_log table to handle PayPal data
ALTER TABLE public.payments_log DROP COLUMN IF EXISTS tap_charge;
ALTER TABLE public.payments_log ADD COLUMN paypal_payment_id TEXT;

-- Create index for better query performance on new PayPal columns
CREATE INDEX IF NOT EXISTS idx_payments_paypal_order_id ON public.payments(paypal_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_paypal_payment_id ON public.payments(paypal_payment_id);
