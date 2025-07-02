-- Add username field to profiles table
ALTER TABLE public.profiles ADD COLUMN username TEXT;

-- Add foreign key constraint between prompts.user_id and profiles.id
ALTER TABLE public.prompts 
ADD CONSTRAINT prompts_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Update existing profiles to have usernames based on their first/last names or email
UPDATE public.profiles 
SET username = LOWER(REGEXP_REPLACE(COALESCE(first_name, '') || COALESCE(last_name, ''), '[^a-zA-Z0-9]', '', 'g'))
WHERE username IS NULL;

-- For any profiles that still don't have usernames, generate them from user IDs
UPDATE public.profiles 
SET username = 'user_' || SUBSTRING(id::text, 1, 8)
WHERE username IS NULL OR username = '';

-- Make username unique and not null
ALTER TABLE public.profiles ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX idx_profiles_username ON public.profiles(username);

-- Update the handle_new_user function to generate usernames
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
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