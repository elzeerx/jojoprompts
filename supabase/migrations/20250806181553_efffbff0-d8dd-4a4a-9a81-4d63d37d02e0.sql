-- Delete users completely by email addresses
DO $$
DECLARE
    target_user_id_1 UUID;
    target_user_id_2 UUID;
BEGIN
    -- Get user IDs from auth.users table
    SELECT id INTO target_user_id_1 FROM auth.users WHERE email = 'n@stayfoolish.net';
    SELECT id INTO target_user_id_2 FROM auth.users WHERE email = 'nawaf9610@gmail.com';
    
    -- Delete user 1 if found
    IF target_user_id_1 IS NOT NULL THEN
        RAISE NOTICE 'Deleting user: n@stayfoolish.net (ID: %)', target_user_id_1;
        
        -- Delete all related data for user 1
        DELETE FROM public.security_logs WHERE user_id = target_user_id_1;
        DELETE FROM public.email_logs WHERE user_id = target_user_id_1;
        DELETE FROM public.admin_audit_log WHERE admin_user_id = target_user_id_1;
        DELETE FROM public.collection_prompts WHERE collection_id IN (SELECT id FROM public.collections WHERE user_id = target_user_id_1);
        DELETE FROM public.collections WHERE user_id = target_user_id_1;
        DELETE FROM public.prompt_shares WHERE shared_by = target_user_id_1;
        DELETE FROM public.prompt_usage_history WHERE user_id = target_user_id_1;
        DELETE FROM public.user_subscriptions WHERE user_id = target_user_id_1;
        DELETE FROM public.transactions WHERE user_id = target_user_id_1;
        DELETE FROM public.favorites WHERE user_id = target_user_id_1;
        DELETE FROM public.prompts WHERE user_id = target_user_id_1;
        DELETE FROM public.discount_code_usage WHERE user_id = target_user_id_1;
        DELETE FROM public.prompt_generator_templates WHERE created_by = target_user_id_1;
        DELETE FROM public.prompt_generator_fields WHERE created_by = target_user_id_1;
        DELETE FROM public.prompt_generator_models WHERE created_by = target_user_id_1;
        DELETE FROM public.discount_codes WHERE created_by = target_user_id_1;
        DELETE FROM public.profiles WHERE id = target_user_id_1;
        
        RAISE NOTICE 'Successfully deleted user: n@stayfoolish.net';
    ELSE
        RAISE NOTICE 'User not found: n@stayfoolish.net';
    END IF;
    
    -- Delete user 2 if found
    IF target_user_id_2 IS NOT NULL THEN
        RAISE NOTICE 'Deleting user: nawaf9610@gmail.com (ID: %)', target_user_id_2;
        
        -- Delete all related data for user 2
        DELETE FROM public.security_logs WHERE user_id = target_user_id_2;
        DELETE FROM public.email_logs WHERE user_id = target_user_id_2;
        DELETE FROM public.admin_audit_log WHERE admin_user_id = target_user_id_2;
        DELETE FROM public.collection_prompts WHERE collection_id IN (SELECT id FROM public.collections WHERE user_id = target_user_id_2);
        DELETE FROM public.collections WHERE user_id = target_user_id_2;
        DELETE FROM public.prompt_shares WHERE shared_by = target_user_id_2;
        DELETE FROM public.prompt_usage_history WHERE user_id = target_user_id_2;
        DELETE FROM public.user_subscriptions WHERE user_id = target_user_id_2;
        DELETE FROM public.transactions WHERE user_id = target_user_id_2;
        DELETE FROM public.favorites WHERE user_id = target_user_id_2;
        DELETE FROM public.prompts WHERE user_id = target_user_id_2;
        DELETE FROM public.discount_code_usage WHERE user_id = target_user_id_2;
        DELETE FROM public.prompt_generator_templates WHERE created_by = target_user_id_2;
        DELETE FROM public.prompt_generator_fields WHERE created_by = target_user_id_2;
        DELETE FROM public.prompt_generator_models WHERE created_by = target_user_id_2;
        DELETE FROM public.discount_codes WHERE created_by = target_user_id_2;
        DELETE FROM public.profiles WHERE id = target_user_id_2;
        
        RAISE NOTICE 'Successfully deleted user: nawaf9610@gmail.com';
    ELSE
        RAISE NOTICE 'User not found: nawaf9610@gmail.com';
    END IF;
END $$;