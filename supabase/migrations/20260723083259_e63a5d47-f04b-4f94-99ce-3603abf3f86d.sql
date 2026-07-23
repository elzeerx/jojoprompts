-- Drop obsolete 3-arg overload; the 7-arg version is the canonical admin RPC.
DROP FUNCTION IF EXISTS public.v2_admin_list_payment_events(integer, integer, uuid);