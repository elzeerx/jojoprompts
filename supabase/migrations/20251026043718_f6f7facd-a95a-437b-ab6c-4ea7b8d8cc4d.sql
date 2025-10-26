-- Fix Security Definer View Issue
-- Convert views to SECURITY INVOKER to enforce RLS policies of querying user

-- Drop and recreate profiles_with_role view with SECURITY INVOKER
DROP VIEW IF EXISTS public.profiles_with_role CASCADE;

CREATE VIEW public.profiles_with_role
WITH (security_invoker = true) AS
SELECT 
  p.*,
  COALESCE(
    (SELECT role::text FROM public.user_roles WHERE user_id = p.id ORDER BY 
      CASE role::text
        WHEN 'admin' THEN 1
        WHEN 'jadmin' THEN 2
        WHEN 'prompter' THEN 3
        WHEN 'user' THEN 4
      END
      LIMIT 1
    ),
    'user'
  ) as role
FROM public.profiles p;

COMMENT ON VIEW public.profiles_with_role IS 
  'DEPRECATED: Temporary view for backward compatibility.
   Use user_roles table directly with has_role() function.
   SECURITY INVOKER: Enforces RLS policies of querying user.';

-- Drop and recreate v_admin_users view with SECURITY INVOKER
DROP VIEW IF EXISTS public.v_admin_users CASCADE;

CREATE VIEW public.v_admin_users
WITH (security_invoker = true) AS
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
  
  -- Role from user_roles table (get highest priority role)
  COALESCE(
    (SELECT role::text FROM public.user_roles WHERE user_id = p.id ORDER BY 
      CASE role::text
        WHEN 'admin' THEN 1
        WHEN 'jadmin' THEN 2
        WHEN 'prompter' THEN 3
        WHEN 'user' THEN 4
      END
      LIMIT 1
    ),
    'user'
  ) as role,
  
  -- Auth metadata placeholders (for backward compatibility)
  NULL::boolean as is_email_confirmed,
  
  -- Subscription data from active subscription
  us.status as subscription_status,
  sp.name as subscription_plan_name,
  sp.is_lifetime as subscription_is_lifetime,
  COALESCE(sp.price_usd, 0) as subscription_price_usd,
  
  -- Auth timestamps placeholders
  NULL::timestamptz as last_sign_in_at,
  NULL::timestamptz as updated_at
FROM public.profiles p
LEFT JOIN LATERAL (
  SELECT * FROM public.user_subscriptions
  WHERE user_id = p.id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1
) us ON true
LEFT JOIN public.subscription_plans sp ON us.plan_id = sp.id;

COMMENT ON VIEW public.v_admin_users IS 
  'Administrative view of users with subscription info.
   SECURITY INVOKER: Enforces RLS policies of querying user.';

-- Grant permissions (views will enforce RLS of querying user)
GRANT SELECT ON public.profiles_with_role TO authenticated;
GRANT SELECT ON public.v_admin_users TO authenticated;