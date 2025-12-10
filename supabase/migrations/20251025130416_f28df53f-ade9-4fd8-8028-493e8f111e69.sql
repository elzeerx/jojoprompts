-- Migration: Fix handle_new_user() trigger to work with user_roles table architecture
-- Date: 2025-10-25
-- Description: Updates the signup trigger to properly insert into user_roles table
--              instead of the removed 'role' column in profiles table.

-- Drop and recreate the handle_new_user() function with correct schema
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  generated_username TEXT;
  username_counter INTEGER := 0;
  default_role app_role := 'user'; -- Default to 'user' role
  is_first_user BOOLEAN := FALSE;
BEGIN
  -- Generate base username from email or name
  generated_username := LOWER(REGEXP_REPLACE(
    COALESCE(
      new.raw_user_meta_data->>'first_name',
      SPLIT_PART(new.raw_user_meta_data->>'full_name', ' ', 1),
      SPLIT_PART(new.email, '@', 1)
    ), '[^a-zA-Z0-9]', '', 'g'
  ));
  
  -- Ensure username is not empty
  IF generated_username = '' THEN
    generated_username := 'user';
  END IF;
  
  -- Make sure username is unique
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = generated_username || CASE WHEN username_counter = 0 THEN '' ELSE username_counter::text END) LOOP
    username_counter := username_counter + 1;
  END LOOP;
  
  IF username_counter > 0 THEN
    generated_username := generated_username || username_counter::text;
  END IF;

  -- Check if this is the very first user (make them admin and super admin)
  IF NOT EXISTS (SELECT 1 FROM public.profiles) THEN
    default_role := 'admin';
    is_first_user := TRUE;
  END IF;

  -- Insert into profiles table (without role column)
  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    username,
    email
  ) VALUES (
    new.id,
    COALESCE(
      new.raw_user_meta_data->>'first_name',
      SPLIT_PART(new.raw_user_meta_data->>'full_name', ' ', 1),
      'User'
    ),
    COALESCE(
      new.raw_user_meta_data->>'last_name',
      SUBSTRING(new.raw_user_meta_data->>'full_name' FROM POSITION(' ' IN new.raw_user_meta_data->>'full_name') + 1),
      ''
    ),
    generated_username,
    new.email
  );
  
  -- Insert role into user_roles table
  INSERT INTO public.user_roles (
    user_id,
    role,
    is_super_admin
  ) VALUES (
    new.id,
    default_role,
    is_first_user
  );
  
  RETURN new;
END;
$$;

-- Add comment explaining the function
COMMENT ON FUNCTION public.handle_new_user() IS 
  'Trigger function that creates profile and assigns role when new user signs up. First user becomes admin with super_admin flag.';