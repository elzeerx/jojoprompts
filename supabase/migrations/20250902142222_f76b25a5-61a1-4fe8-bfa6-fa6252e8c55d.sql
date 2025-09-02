-- Fix security issue: Add search_path to functions that don't have it set
-- This addresses the 0011_function_search_path_mutable warning

-- Update the handle_new_user function to have proper search path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = 'public'
AS $$
DECLARE
  generated_username TEXT;
  username_counter INTEGER := 0;
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

  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    username,
    role
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
    CASE 
      WHEN NOT EXISTS (SELECT 1 FROM public.profiles) THEN 'admin'
      ELSE 'user'
    END
  );
  RETURN new;
END;
$$;