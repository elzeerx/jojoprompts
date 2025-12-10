-- Allow authenticated users to read basic profile info for display purposes
-- This enables showing uploader username and avatar on prompt cards
CREATE POLICY "Authenticated users can view basic profile info"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);