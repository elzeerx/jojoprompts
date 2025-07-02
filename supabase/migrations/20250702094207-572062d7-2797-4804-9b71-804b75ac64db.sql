-- Step 1: Create profiles for any users that don't have them yet
INSERT INTO public.profiles (id, first_name, last_name, username, role)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'first_name', 'User') as first_name,
  COALESCE(au.raw_user_meta_data->>'last_name', '') as last_name,
  'user_' || SUBSTRING(au.id::text, 1, 8) as username,
  'user' as role
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = au.id
);

-- Step 2: Add foreign key constraint from prompts.user_id to profiles.id
ALTER TABLE public.prompts 
ADD CONSTRAINT fk_prompts_user_id 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Step 3: Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_prompts_user_id ON public.prompts(user_id);