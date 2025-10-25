-- Create v_admin_users view for unified admin user management
-- This view consolidates profiles, roles, and subscriptions in one place
-- Protected by RLS on underlying tables

CREATE OR REPLACE VIEW v_admin_users AS
SELECT 
  p.id,
  p.first_name,
  p.last_name,
  p.username,
  p.email,
  p.avatar_url,
  p.bio,
  p.country,
  p.phone_number,
  p.timezone,
  p.membership_tier,
  p.social_links,
  p.created_at,
  
  -- Role from user_roles (cast to text, default to 'user' if no role assigned)
  COALESCE(ur.role::text, 'user') as role,
  
  -- Subscription data (from active subscription)
  us.status as subscription_status,
  sp.name as subscription_plan_name,
  sp.is_lifetime as subscription_is_lifetime,
  COALESCE(sp.price_usd, 0) as subscription_price_usd,
  
  -- Additional admin metadata (not available from database, placeholders for compatibility)
  NULL::timestamp with time zone as last_sign_in_at,
  NULL::timestamp with time zone as updated_at,
  false as is_email_confirmed

FROM profiles p

-- Get user role (LEFT JOIN to allow users without explicit roles)
LEFT JOIN user_roles ur ON p.id = ur.user_id

-- Get active subscription (LEFT JOIN to allow users without subscriptions)
LEFT JOIN LATERAL (
  SELECT user_id, plan_id, status
  FROM user_subscriptions
  WHERE user_id = p.id 
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1
) us ON true

-- Get subscription plan details
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id

ORDER BY p.created_at DESC;

-- Grant access to authenticated users (RLS on underlying tables will still apply)
GRANT SELECT ON v_admin_users TO authenticated;