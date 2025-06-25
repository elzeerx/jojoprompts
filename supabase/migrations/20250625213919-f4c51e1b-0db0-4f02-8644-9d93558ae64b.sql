
-- Add RLS policies for transactions table to allow admin access
CREATE POLICY "Admins can view all transactions" 
  ON public.transactions 
  FOR SELECT 
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update transactions" 
  ON public.transactions 
  FOR UPDATE 
  USING (public.has_role(auth.uid(), 'admin'));
