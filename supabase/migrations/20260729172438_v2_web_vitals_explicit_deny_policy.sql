-- Make the intentional fail-closed browser boundary explicit to both Postgres
-- and the Supabase database advisor. The service role bypasses RLS and remains
-- the only ingestion path; authenticated admins use the aggregation RPC.
CREATE POLICY web_vital_samples_deny_direct_access
ON public.web_vital_samples
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
