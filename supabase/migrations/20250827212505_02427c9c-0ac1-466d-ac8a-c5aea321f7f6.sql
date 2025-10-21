-- Fix the foreign key relationship between prompts and profiles
-- First, let's check if there are any existing foreign key constraints on prompts.user_id
-- and update them to reference profiles instead of auth.users

-- Drop existing foreign key if it exists (referencing auth.users)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'prompts_user_id_fkey' 
        AND table_name = 'prompts'
    ) THEN
        ALTER TABLE public.prompts DROP CONSTRAINT prompts_user_id_fkey;
    END IF;
END $$;

-- Add proper foreign key constraint to profiles table
ALTER TABLE public.prompts 
ADD CONSTRAINT prompts_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- Ensure all existing prompts have corresponding profiles
-- This will create profiles for any users that don't have them yet
INSERT INTO public.profiles (id, first_name, last_name, username, role)
SELECT DISTINCT 
    p.user_id,
    'User' as first_name,
    '' as last_name,
    COALESCE(
        LOWER(REGEXP_REPLACE(p.user_id::text, '[^a-zA-Z0-9]', '', 'g')),
        'user_' || EXTRACT(epoch FROM NOW())::text
    ) as username,
    'user' as role
FROM public.prompts p
LEFT JOIN public.profiles pr ON pr.id = p.user_id
WHERE pr.id IS NULL
ON CONFLICT (id) DO NOTHING;