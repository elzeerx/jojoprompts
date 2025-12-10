-- =====================================================
-- ADDRESS REMAINING CRITICAL SECURITY FINDINGS
-- =====================================================

-- 1. FIX TRANSACTIONS TABLE (if it exists)
-- The previous migration used DO block, let's ensure it worked correctly
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'transactions') THEN
    -- Drop any overly permissive policies
    DROP POLICY IF EXISTS "Enable read access for all users" ON public.transactions;
    DROP POLICY IF EXISTS "Public read access" ON public.transactions;
    
    -- Ensure RLS is enabled
    ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
    
    -- Recreate policies with proper security
    DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
    DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;
    DROP POLICY IF EXISTS "Service role can manage transactions" ON public.transactions;
    
    -- Users can only view their own transactions
    EXECUTE 'CREATE POLICY "Users can view own transactions"
    ON public.transactions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id)';
    
    -- Admins can view all transactions
    EXECUTE 'CREATE POLICY "Admins can view all transactions"
    ON public.transactions
    FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), ''admin''::app_role))';
    
    -- Only service role can insert/update/delete transactions
    EXECUTE 'CREATE POLICY "Service role can manage transactions"
    ON public.transactions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true)';
    
    -- Block public anonymous access completely
    EXECUTE 'CREATE POLICY "Block anonymous access to transactions"
    ON public.transactions
    FOR ALL
    TO anon
    USING (false)';
    
    RAISE NOTICE 'Transactions table security policies updated successfully';
  ELSE
    RAISE NOTICE 'Transactions table does not exist, skipping';
  END IF;
END $$;

-- 2. VERIFY PROFILES TABLE RLS IS SECURE
-- Add additional policy to explicitly block anonymous access to sensitive fields
CREATE POLICY "Block anonymous access to profiles"
ON public.profiles
FOR SELECT
TO anon
USING (false);

-- Ensure only authenticated users can see profiles
-- (Either own profile OR admin viewing others)
DROP POLICY IF EXISTS "Public can view basic profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;

-- =====================================================
-- VERIFY EXISTING POLICIES ARE SUFFICIENT
-- =====================================================

-- Profiles table should now only allow:
-- 1. Users viewing their own complete profile (authenticated)
-- 2. Admins viewing all profiles (authenticated)  
-- 3. Anonymous users: BLOCKED

-- Transactions table should now only allow:
-- 1. Users viewing their own transactions (authenticated)
-- 2. Admins viewing all transactions (authenticated)
-- 3. Service role managing transactions (backend only)
-- 4. Anonymous users: BLOCKED

-- =====================================================
-- SUMMARY OF REMAINING FINDINGS:
-- =====================================================
-- ✅ FIXED: transactions table - Now properly protected
-- ✅ FIXED: profiles table - Anonymous access blocked
-- 
-- ⚠️  INTENTIONAL PUBLIC ACCESS (Business decisions):
-- - subscription_plans: Public for pricing page display
-- - platforms/platform_fields: Public for integration browsing
-- - categories: Public for feature browsing
-- - prompts: Available to authenticated users (content sharing platform)
-- 
-- These remaining findings are ACCEPTED as part of the business model.
-- =====================================================