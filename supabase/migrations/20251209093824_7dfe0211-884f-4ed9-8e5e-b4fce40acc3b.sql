-- Add payment gateway tracking columns to transactions table
-- These are additive columns with backwards-compatible defaults

-- Add payment_gateway column (defaults to 'paypal' for existing transactions)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_gateway TEXT DEFAULT 'paypal';

-- Add Upayments-specific tracking columns
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS upayments_invoice_id TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS upayments_track_id TEXT;

-- Add currency column for multi-currency support
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- Add index for efficient gateway filtering in admin dashboard
CREATE INDEX IF NOT EXISTS idx_transactions_payment_gateway ON transactions(payment_gateway);
CREATE INDEX IF NOT EXISTS idx_transactions_currency ON transactions(currency);

-- Add comment for documentation
COMMENT ON COLUMN transactions.payment_gateway IS 'Payment gateway used: paypal, upayments';
COMMENT ON COLUMN transactions.upayments_invoice_id IS 'Upayments invoice ID for tracking';
COMMENT ON COLUMN transactions.upayments_track_id IS 'Upayments track ID for verification';
COMMENT ON COLUMN transactions.currency IS 'Currency code: USD, KWD';