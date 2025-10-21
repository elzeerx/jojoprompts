-- Add RLS policies for prompt-files storage bucket
-- Allow authenticated users to view workflow files
CREATE POLICY "Authenticated users can view workflow files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'prompt-files');

-- Allow admins, prompters, and jadmins to upload workflow files
CREATE POLICY "Privileged users can upload workflow files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'prompt-files' 
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() 
      AND role IN ('admin', 'prompter', 'jadmin')
    )
  )
);

-- Allow admins to delete workflow files
CREATE POLICY "Admins can delete workflow files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'prompt-files'
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  )
);

-- Allow admins to update workflow files
CREATE POLICY "Admins can update workflow files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'prompt-files'
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  )
);