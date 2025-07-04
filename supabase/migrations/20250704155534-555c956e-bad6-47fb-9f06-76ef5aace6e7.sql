-- Step 1: Update storage bucket policies for prompt-images to allow role-based access
-- First, drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "Users can upload their own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own images" ON storage.objects;

-- Create new policies for prompt-images bucket that work with the role system
CREATE POLICY "Privileged users can upload images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'prompt-images' AND 
  can_manage_prompts(auth.uid())
);

CREATE POLICY "Privileged users can view images" ON storage.objects
FOR SELECT USING (
  bucket_id = 'prompt-images' AND 
  (can_manage_prompts(auth.uid()) OR auth.uid()::text = (storage.foldername(name))[1])
);

CREATE POLICY "Privileged users can update images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'prompt-images' AND 
  can_manage_prompts(auth.uid())
);

CREATE POLICY "Privileged users can delete images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'prompt-images' AND 
  can_manage_prompts(auth.uid())
);

-- Step 2: Update existing users to have prompter role (for testing)
-- This will allow current users to test the prompt management features
UPDATE profiles 
SET role = 'prompter' 
WHERE role = 'user' 
AND id IN (
  SELECT id FROM profiles 
  WHERE role = 'user' 
  LIMIT 3  -- Update first 3 users to prompter for testing
);

-- Step 3: Update storage policies for new buckets to use role-based access
-- Update video bucket policies
DROP POLICY IF EXISTS "Users can upload their own videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own videos" ON storage.objects;

CREATE POLICY "Privileged users can upload videos" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'prompt-videos' AND 
  can_manage_prompts(auth.uid())
);

CREATE POLICY "Privileged users can view videos" ON storage.objects
FOR SELECT USING (
  bucket_id = 'prompt-videos' AND 
  (can_manage_prompts(auth.uid()) OR auth.uid()::text = (storage.foldername(name))[1])
);

CREATE POLICY "Privileged users can update videos" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'prompt-videos' AND 
  can_manage_prompts(auth.uid())
);

CREATE POLICY "Privileged users can delete videos" ON storage.objects
FOR DELETE USING (
  bucket_id = 'prompt-videos' AND 
  can_manage_prompts(auth.uid())
);

-- Update audio bucket policies
DROP POLICY IF EXISTS "Users can upload their own audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own audio" ON storage.objects;

CREATE POLICY "Privileged users can upload audio" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'prompt-audio' AND 
  can_manage_prompts(auth.uid())
);

CREATE POLICY "Privileged users can view audio" ON storage.objects
FOR SELECT USING (
  bucket_id = 'prompt-audio' AND 
  (can_manage_prompts(auth.uid()) OR auth.uid()::text = (storage.foldername(name))[1])
);

CREATE POLICY "Privileged users can update audio" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'prompt-audio' AND 
  can_manage_prompts(auth.uid())
);

CREATE POLICY "Privileged users can delete audio" ON storage.objects
FOR DELETE USING (
  bucket_id = 'prompt-audio' AND 
  can_manage_prompts(auth.uid())
);

-- Update files bucket policies
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

CREATE POLICY "Privileged users can upload files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'prompt-files' AND 
  can_manage_prompts(auth.uid())
);

CREATE POLICY "Privileged users can view files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'prompt-files' AND 
  (can_manage_prompts(auth.uid()) OR auth.uid()::text = (storage.foldername(name))[1])
);

CREATE POLICY "Privileged users can update files" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'prompt-files' AND 
  can_manage_prompts(auth.uid())
);

CREATE POLICY "Privileged users can delete files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'prompt-files' AND 
  can_manage_prompts(auth.uid())
);