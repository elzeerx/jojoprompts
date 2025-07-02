-- Add username field to profiles table
ALTER TABLE public.profiles ADD COLUMN username TEXT;

-- Update existing profiles to have unique usernames
DO $$
DECLARE
    profile_record RECORD;
    base_username TEXT;
    final_username TEXT;
    counter INTEGER;
BEGIN
    FOR profile_record IN SELECT id, first_name, last_name FROM public.profiles WHERE username IS NULL LOOP
        -- Generate base username
        base_username := LOWER(REGEXP_REPLACE(COALESCE(profile_record.first_name, '') || COALESCE(profile_record.last_name, ''), '[^a-zA-Z0-9]', '', 'g'));
        
        -- If empty, use user prefix
        IF base_username = '' THEN
            base_username := 'user_' || SUBSTRING(profile_record.id::text, 1, 8);
        END IF;
        
        -- Find unique username
        final_username := base_username;
        counter := 0;
        
        WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
            counter := counter + 1;
            final_username := base_username || counter::text;
        END LOOP;
        
        -- Update with unique username
        UPDATE public.profiles SET username = final_username WHERE id = profile_record.id;
    END LOOP;
END $$;

-- Make username not null and unique
ALTER TABLE public.profiles ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX idx_profiles_username ON public.profiles(username);