-- Update nawaf@elzeer.com to have admin role in profiles table
UPDATE public.profiles 
SET role = 'admin', updated_at = now()
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'nawaf@elzeer.com'
);