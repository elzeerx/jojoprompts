
-- Create payments table to store Tap payment information
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    tap_charge_id TEXT UNIQUE,
    tap_reference TEXT,
    amount INTEGER,
    currency TEXT DEFAULT 'USD',
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add membership_tier column to profiles table
ALTER TABLE public.profiles ADD COLUMN membership_tier TEXT DEFAULT 'free';

-- Enable Row Level Security on payments table
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for payments table
CREATE POLICY "Users can view their own payments" 
  ON public.payments 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payments" 
  ON public.payments 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all payments" 
  ON public.payments 
  FOR SELECT 
  USING (public.has_role(auth.uid(), 'admin'));

-- Create index for better query performance
CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_payments_tap_charge_id ON public.payments(tap_charge_id);
