-- Create storage policies for the storage.bucket to allow uploads
CREATE POLICY "Allow authenticated users to upload files" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'storage.bucket');

CREATE POLICY "Allow public access to view files" 
ON storage.objects 
FOR SELECT 
TO public
USING (bucket_id = 'storage.bucket');

CREATE POLICY "Allow authenticated users to update files" 
ON storage.objects 
FOR UPDATE 
TO authenticated
USING (bucket_id = 'storage.bucket');

CREATE POLICY "Allow authenticated users to delete files" 
ON storage.objects 
FOR DELETE 
TO authenticated
USING (bucket_id = 'storage.bucket');