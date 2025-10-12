-- Phase 1: Fix has_role function overloading ambiguity
-- Drop the legacy text-based function and recreate dependent policies

-- Step 1: Drop the legacy function with CASCADE (removes dependent policies)
DROP FUNCTION IF EXISTS public.has_role(uuid, text) CASCADE;

-- Step 2: Recreate all policies using the secure enum-based has_role function

-- user_subscriptions policies
CREATE POLICY "Admins can delete user subscriptions" 
ON public.user_subscriptions 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- categories policies  
CREATE POLICY "Admins can manage categories" 
ON public.categories 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- transactions policies
CREATE POLICY "Admins can update transactions" 
ON public.transactions 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all transactions" 
ON public.transactions 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- apple_email_logs policies
CREATE POLICY "Admins can view all Apple email logs" 
ON public.apple_email_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- discount_code_usage policies
CREATE POLICY "Admins can view all discount code usage" 
ON public.discount_code_usage 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- email_engagement policies
CREATE POLICY "Admins can view all email engagement data" 
ON public.email_engagement 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- unsubscribed_emails policies
CREATE POLICY "Admins can view all unsubscribed emails" 
ON public.unsubscribed_emails 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- user_roles policies
CREATE POLICY "Admins can view all roles" 
ON public.user_roles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can assign roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can modify roles" 
ON public.user_roles 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete roles" 
ON public.user_roles 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- profiles policies (allow both admin and jadmin)
CREATE POLICY "profiles_admin_access" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'jadmin'::app_role));

CREATE POLICY "profiles_admin_update" 
ON public.profiles 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "profiles_admin_delete" 
ON public.profiles 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add documentation
COMMENT ON FUNCTION public.has_role(uuid, app_role) IS 
  'Secure role check function using user_roles table and app_role enum. 
   Uses SECURITY DEFINER to prevent RLS recursion issues.
   All policies now use this enum-based version.';