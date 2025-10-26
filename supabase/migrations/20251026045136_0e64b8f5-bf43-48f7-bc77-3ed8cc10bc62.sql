-- Phase 1: Fix storage bucket policies for prompt-files with subscription validation

-- 1. Create function to check if user has active subscription
CREATE OR REPLACE FUNCTION public.has_active_subscription()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  -- Return false if no authenticated user
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if user has any active subscription
  RETURN EXISTS (
    SELECT 1
    FROM public.user_subscriptions
    WHERE user_id = current_user_id
      AND status = 'active'
      AND (end_date IS NULL OR end_date > NOW())
  );
END;
$function$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.has_active_subscription() TO authenticated;

-- 2. Drop all existing policies for prompt-files bucket (comprehensive list)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Privileged users can view files" ON storage.objects;
  DROP POLICY IF EXISTS "Privileged users can upload workflow files" ON storage.objects;
  DROP POLICY IF EXISTS "Privileged users can update workflow files" ON storage.objects;
  DROP POLICY IF EXISTS "Privileged users can delete workflow files" ON storage.objects;
  DROP POLICY IF EXISTS "Users with subscription can view workflow files" ON storage.objects;
  DROP POLICY IF EXISTS "Subscribed users can view workflow files" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can upload workflow files" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can update workflow files" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can delete workflow files" ON storage.objects;
EXCEPTION WHEN OTHERS THEN
  -- Continue if policies don't exist
  NULL;
END $$;

-- 3. Create new policies with unique names
CREATE POLICY "prompt_files_select_subscription_v2"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'prompt-files'
  AND (
    -- Admins and prompters can access all files
    public.can_manage_prompts(auth.uid())
    -- OR users with active subscriptions can access files
    OR public.has_active_subscription()
  )
);

CREATE POLICY "prompt_files_insert_admin_v2"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'prompt-files'
  AND public.can_manage_prompts(auth.uid())
);

CREATE POLICY "prompt_files_update_admin_v2"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'prompt-files'
  AND public.can_manage_prompts(auth.uid())
)
WITH CHECK (
  bucket_id = 'prompt-files'
  AND public.can_manage_prompts(auth.uid())
);

CREATE POLICY "prompt_files_delete_admin_v2"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'prompt-files'
  AND public.can_manage_prompts(auth.uid())
);