-- Add new optional profile fields for enhanced user information
ALTER TABLE public.profiles 
ADD COLUMN bio TEXT,
ADD COLUMN avatar_url TEXT,
ADD COLUMN country TEXT,
ADD COLUMN phone_number TEXT,
ADD COLUMN social_links JSONB DEFAULT '{}'::jsonb,
ADD COLUMN timezone TEXT;