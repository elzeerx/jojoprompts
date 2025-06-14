
-- Clean up existing payment-related tables and create a simple structure
DROP TABLE IF EXISTS public.payment_history CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.payments_log CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;

-- Create a simple transactions table
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  paypal_order_id TEXT,
  paypal_payment_id TEXT,
  amount_usd NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Add RLS policies for transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions" 
  ON public.transactions 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own transactions" 
  ON public.transactions 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Update user_subscriptions to reference transactions
ALTER TABLE public.user_subscriptions 
ADD COLUMN transaction_id UUID REFERENCES public.transactions(id);
