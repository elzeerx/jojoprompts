
-- Create a database function for safe user account deletion with subscription cancellation
CREATE OR REPLACE FUNCTION public.delete_user_account(_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  _subscription_record record;
  _result json;
BEGIN
  -- First, cancel any active subscriptions
  SELECT * INTO _subscription_record
  FROM public.user_subscriptions
  WHERE user_id = _user_id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.user_subscriptions
    SET status = 'cancelled', updated_at = now()
    WHERE id = _subscription_record.id;
  END IF;

  -- Delete user data in correct order to avoid FK constraint errors
  -- Delete collection_prompts first
  DELETE FROM public.collection_prompts 
  WHERE collection_id IN (SELECT id FROM public.collections WHERE user_id = _user_id);
  
  -- Delete collections
  DELETE FROM public.collections WHERE user_id = _user_id;
  
  -- Delete prompt shares
  DELETE FROM public.prompt_shares WHERE shared_by = _user_id;
  
  -- Delete prompt usage history
  DELETE FROM public.prompt_usage_history WHERE user_id = _user_id;
  
  -- Delete user subscriptions
  DELETE FROM public.user_subscriptions WHERE user_id = _user_id;
  
  -- Delete transactions
  DELETE FROM public.transactions WHERE user_id = _user_id;
  
  -- Delete favorites
  DELETE FROM public.favorites WHERE user_id = _user_id;
  
  -- Delete prompts created by user
  DELETE FROM public.prompts WHERE user_id = _user_id;
  
  -- Delete discount code usage
  DELETE FROM public.discount_code_usage WHERE user_id = _user_id;
  
  -- Delete profile
  DELETE FROM public.profiles WHERE id = _user_id;

  -- Return success
  RETURN json_build_object(
    'success', true, 
    'message', 'Account deleted successfully',
    'subscription_cancelled', FOUND
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false, 
      'error', SQLERRM
    );
END;
$function$
