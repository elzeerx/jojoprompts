
-- Phase 1: Remove duplicate subscription plans (the ones added on 2025-06-07)
DELETE FROM subscription_plans 
WHERE id IN (
  'a7fe6d0e-fa72-445e-8b2c-572e0efcdb39',
  '0f435d02-dea2-4cd7-97a6-fcb32ab10980', 
  'c9a4bf02-57d1-4cc5-a5b7-949785f219b7',
  'c383b77b-d372-48f2-a846-9341cb676811'
);

-- Phase 2: Remove KWD currency columns from database tables
ALTER TABLE subscription_plans DROP COLUMN IF EXISTS price_kwd;
ALTER TABLE payment_history DROP COLUMN IF EXISTS amount_kwd;
ALTER TABLE payment_history DROP COLUMN IF EXISTS discount_amount_kwd;
ALTER TABLE payment_history DROP COLUMN IF EXISTS original_amount_kwd;
