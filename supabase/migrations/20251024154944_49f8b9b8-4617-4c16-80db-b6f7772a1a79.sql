-- Phase 2: Consolidate Role Management - Safe Migration
-- This migration removes profiles.role column and updates all dependent policies

-- Step 1: Drop all RLS policies that depend on profiles.role column
DROP POLICY IF EXISTS "Admins and prompters can manage fields" ON public.prompt_generator_fields;
DROP POLICY IF EXISTS "Admins and prompters can view all fields" ON public.prompt_generator_fields;
DROP POLICY IF EXISTS "Admins and prompters can manage models" ON public.prompt_generator_models;
DROP POLICY IF EXISTS "Admins and prompters can view all models" ON public.prompt_generator_models;
DROP POLICY IF EXISTS "Admins and prompters can manage templates" ON public.prompt_generator_templates;
DROP POLICY IF EXISTS "Users can view public templates and own templates" ON public.prompt_generator_templates;
DROP POLICY IF EXISTS "Admins can manage discount codes" ON public.discount_codes;
DROP POLICY IF EXISTS "Admins can view discount code usage" ON public.discount_code_usage;

-- Drop storage policies that depend on profiles.role
DROP POLICY IF EXISTS "Only admins can delete prompt images" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can update prompt images" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can upload prompt images" ON storage.objects;
DROP POLICY IF EXISTS "Privileged users can upload workflow files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete workflow files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update workflow files" ON storage.objects;

-- Step 2: Remove the role column from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

COMMENT ON TABLE public.profiles IS 
  'User profile information. 
   IMPORTANT: Roles are stored in user_roles table, NOT in this table.
   Use has_role() function for role checks.';

-- Step 3: Create helper function to check if user has any role
CREATE OR REPLACE FUNCTION public.user_has_any_role(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
  )
$$;

-- Step 4: Create backward compatibility view
CREATE OR REPLACE VIEW public.profiles_with_role AS
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
   Use user_roles table directly with has_role() function.';

-- Step 5: Update v_admin_users view to use user_roles table
DROP VIEW IF EXISTS public.v_admin_users CASCADE;

CREATE OR REPLACE VIEW public.v_admin_users AS
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
  
  -- Email confirmation status (NULL - will be enriched by edge function)
  NULL::boolean as is_email_confirmed,
  
  -- Subscription data
  us.status as subscription_status,
  sp.name as subscription_plan_name,
  sp.is_lifetime as subscription_is_lifetime,
  COALESCE(sp.price_usd, 0) as subscription_price_usd,
  
  -- Placeholder fields for edge function enrichment
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

-- Step 6: Recreate all RLS policies using has_role() function

-- Prompt generator fields policies
CREATE POLICY "Admins and prompters can manage fields" 
ON public.prompt_generator_fields
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'prompter'::app_role) OR 
  has_role(auth.uid(), 'jadmin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'prompter'::app_role) OR 
  has_role(auth.uid(), 'jadmin'::app_role)
);

CREATE POLICY "Admins and prompters can view all fields" 
ON public.prompt_generator_fields
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'prompter'::app_role) OR 
  has_role(auth.uid(), 'jadmin'::app_role)
);

-- Prompt generator models policies
CREATE POLICY "Admins and prompters can manage models" 
ON public.prompt_generator_models
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'prompter'::app_role) OR 
  has_role(auth.uid(), 'jadmin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'prompter'::app_role) OR 
  has_role(auth.uid(), 'jadmin'::app_role)
);

CREATE POLICY "Admins and prompters can view all models" 
ON public.prompt_generator_models
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'prompter'::app_role) OR 
  has_role(auth.uid(), 'jadmin'::app_role)
);

-- Prompt generator templates policies
CREATE POLICY "Admins and prompters can manage templates" 
ON public.prompt_generator_templates
FOR ALL
TO authenticated
USING (
  (created_by = auth.uid()) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'prompter'::app_role) OR 
  has_role(auth.uid(), 'jadmin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'prompter'::app_role) OR 
  has_role(auth.uid(), 'jadmin'::app_role)
);

CREATE POLICY "Users can view public templates and own templates" 
ON public.prompt_generator_templates
FOR SELECT
TO authenticated
USING (
  (is_public = true) OR 
  (created_by = auth.uid()) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'prompter'::app_role) OR 
  has_role(auth.uid(), 'jadmin'::app_role)
);

-- Discount codes policies
CREATE POLICY "Admins can manage discount codes" 
ON public.discount_codes
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Discount code usage policies
CREATE POLICY "Admins can view discount code usage" 
ON public.discount_code_usage
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Storage policies for prompt images
CREATE POLICY "Only admins can delete prompt images" 
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'prompt-images' AND 
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Only admins can update prompt images" 
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'prompt-images' AND 
  has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  bucket_id = 'prompt-images' AND 
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Only admins can upload prompt images" 
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'prompt-images' AND 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Storage policies for workflow files
CREATE POLICY "Privileged users can upload workflow files" 
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'prompt-files' AND 
  (has_role(auth.uid(), 'admin'::app_role) OR 
   has_role(auth.uid(), 'prompter'::app_role))
);

CREATE POLICY "Admins can delete workflow files" 
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'prompt-files' AND 
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update workflow files" 
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'prompt-files' AND 
  has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  bucket_id = 'prompt-files' AND 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Step 7: Grant permissions
GRANT SELECT ON public.profiles_with_role TO authenticated;
GRANT SELECT ON public.v_admin_users TO authenticated;