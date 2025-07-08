-- Ensure storage buckets exist for different media types
-- These will be created if they don't exist, ignored if they do

-- Create prompt-videos bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('prompt-videos', 'prompt-videos', false)
ON CONFLICT (id) DO NOTHING;

-- Create prompt-audio bucket  
INSERT INTO storage.buckets (id, name, public)
VALUES ('prompt-audio', 'prompt-audio', false)
ON CONFLICT (id) DO NOTHING;

-- Create prompt-files bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('prompt-files', 'prompt-files', false)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the new buckets
CREATE POLICY "Users can upload their own videos" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'prompt-videos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own videos" ON storage.objects
FOR SELECT USING (
  bucket_id = 'prompt-videos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own videos" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'prompt-videos' AND 
  auth.uid()::text = (storage.foldername(name))[1]  
);

CREATE POLICY "Users can delete their own videos" ON storage.objects
FOR DELETE USING (
  bucket_id = 'prompt-videos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload their own audio" ON storage.objects  
FOR INSERT WITH CHECK (
  bucket_id = 'prompt-audio' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own audio" ON storage.objects
FOR SELECT USING (
  bucket_id = 'prompt-audio' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own audio" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'prompt-audio' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own audio" ON storage.objects
FOR DELETE USING (
  bucket_id = 'prompt-audio' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload their own files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'prompt-files' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'prompt-files' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own files" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'prompt-files' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'prompt-files' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);