-- Fix RLS Performance Issues on Prompts Table
-- Replace direct auth.uid() calls with cached (SELECT auth.uid()) calls
-- Consolidate overlapping policies for better performance

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Only admins can create prompts" ON public.prompts;
DROP POLICY IF EXISTS "Only admins can delete prompts" ON public.prompts;
DROP POLICY IF EXISTS "Only admins can update prompts" ON public.prompts;
DROP POLICY IF EXISTS "Users can delete own prompts, admins can delete all" ON public.prompts;
DROP POLICY IF EXISTS "Users can update own prompts, admins can update all" ON public.prompts;
DROP POLICY IF EXISTS "Authenticated users can view prompts" ON public.prompts;
DROP POLICY IF EXISTS "Everyone can view prompts" ON public.prompts;
DROP POLICY IF EXISTS "Anyone can read prompts" ON public.prompts;

-- Create optimized consolidated policies with cached auth.uid() calls

-- SELECT policy - Public read access (consolidated from multiple redundant policies)
CREATE POLICY "Public can view all prompts" ON public.prompts
FOR SELECT 
USING (true);

-- INSERT policy - Privileged users only (using existing optimized function)
CREATE POLICY "Privileged users can create prompts" ON public.prompts
FOR INSERT 
WITH CHECK (can_manage_prompts((SELECT auth.uid())));

-- UPDATE policy - Users can update own prompts, privileged users can update all
CREATE POLICY "Users can update own prompts or privileged users all" ON public.prompts
FOR UPDATE 
USING (
  user_id = (SELECT auth.uid()) OR 
  can_manage_prompts((SELECT auth.uid()))
);

-- DELETE policy - Users can delete own prompts, privileged users can delete all  
CREATE POLICY "Users can delete own prompts or privileged users all" ON public.prompts
FOR DELETE 
USING (
  user_id = (SELECT auth.uid()) OR 
  can_manage_prompts((SELECT auth.uid()))
);