-- Create abandoned_cart_sequences table for tracking email recovery sequences
CREATE TABLE public.abandoned_cart_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  plan_id TEXT,
  plan_name TEXT,
  plan_price NUMERIC,
  currency TEXT DEFAULT 'USD',
  sequence_step INTEGER DEFAULT 1 CHECK (sequence_step BETWEEN 1 AND 3),
  email_1_sent_at TIMESTAMPTZ,
  email_2_sent_at TIMESTAMPTZ,
  email_3_sent_at TIMESTAMPTZ,
  next_email_scheduled_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'converted', 'expired', 'unsubscribed', 'paused')),
  conversion_date TIMESTAMPTZ,
  magic_link_token TEXT,
  magic_link_expires_at TIMESTAMPTZ,
  user_email TEXT NOT NULL,
  user_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_abandoned_cart_user_id ON abandoned_cart_sequences(user_id);
CREATE INDEX idx_abandoned_cart_status ON abandoned_cart_sequences(status);
CREATE INDEX idx_abandoned_cart_next_email ON abandoned_cart_sequences(next_email_scheduled_at) WHERE status = 'active';
CREATE INDEX idx_abandoned_cart_transaction ON abandoned_cart_sequences(transaction_id);

-- Enable RLS
ALTER TABLE abandoned_cart_sequences ENABLE ROW LEVEL SECURITY;

-- Admins can manage all sequences
CREATE POLICY "Admins can manage abandoned cart sequences"
ON abandoned_cart_sequences FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- System/service role can insert and update
CREATE POLICY "Service role can manage sequences"
ON abandoned_cart_sequences FOR ALL
USING (auth.uid() IS NULL)
WITH CHECK (auth.uid() IS NULL);

-- Users can view their own sequences
CREATE POLICY "Users can view own sequences"
ON abandoned_cart_sequences FOR SELECT
USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_abandoned_cart_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_abandoned_cart_timestamp
BEFORE UPDATE ON abandoned_cart_sequences
FOR EACH ROW
EXECUTE FUNCTION update_abandoned_cart_updated_at();

-- Create function to auto-create abandoned cart sequence when transaction goes pending
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
    FROM profiles WHERE id = NEW.user_id;
    
    -- Get plan details
    SELECT name, COALESCE(price_usd, 0) INTO v_plan_name, v_plan_price
    FROM subscription_plans WHERE id::text = NEW.plan_id;
    
    -- Only create if user email exists and no active sequence for this transaction
    IF v_user_email IS NOT NULL THEN
      INSERT INTO abandoned_cart_sequences (
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
    UPDATE abandoned_cart_sequences 
    SET status = 'converted', conversion_date = now()
    WHERE transaction_id = NEW.id AND status = 'active';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on transactions table
DROP TRIGGER IF EXISTS trigger_abandoned_cart_sequence ON transactions;
CREATE TRIGGER trigger_abandoned_cart_sequence
AFTER INSERT OR UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION create_abandoned_cart_sequence();