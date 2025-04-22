
-- Create a function to allow admins to get all users via the supabase client
CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Check if the current user is an admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: only admins can view all users';
  END IF;

  -- Call the edge function to get the user data
  SELECT supabase_edge_function('get-all-users') INTO result;
  
  RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_all_users() TO authenticated;
