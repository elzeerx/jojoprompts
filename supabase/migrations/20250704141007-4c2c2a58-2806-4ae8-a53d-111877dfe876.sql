-- Insert profile for the current user with prompter role
INSERT INTO public.profiles (id, first_name, last_name, username, role)
VALUES (
  'f23e5803-7291-4bce-a91e-218308985e14',
  'User',
  'Prompter',
  'userprompter',
  'prompter'
) ON CONFLICT (id) DO UPDATE SET
  role = 'prompter',
  updated_at = now();