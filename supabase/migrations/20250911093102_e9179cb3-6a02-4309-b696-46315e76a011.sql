-- Fix critical log integrity issues

-- 1. Fix admin_audit_log RLS policies
DROP POLICY IF EXISTS "System can insert audit logs" ON public.admin_audit_log;
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_log;

-- Create secure RLS policies for admin_audit_log
CREATE POLICY "Verified admins can view audit logs" ON public.admin_audit_log
FOR SELECT USING (is_verified_admin('view_audit_logs'));

CREATE POLICY "System functions can insert audit logs" ON public.admin_audit_log
FOR INSERT WITH CHECK (true); -- Will be controlled by trigger

-- Create trigger to ensure admin_user_id integrity
CREATE OR REPLACE FUNCTION public.secure_admin_audit_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Only allow if called by verified admin or system function
  IF auth.uid() IS NOT NULL AND NOT is_verified_admin('create_audit_log') THEN
    RAISE EXCEPTION 'Unauthorized audit log creation attempt';
  END IF;
  
  -- Force admin_user_id to current user if not system call
  IF auth.uid() IS NOT NULL THEN
    NEW.admin_user_id := auth.uid();
  END IF;
  
  -- Ensure timestamp is set
  IF NEW.timestamp IS NULL THEN
    NEW.timestamp := now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER secure_admin_audit_trigger
  BEFORE INSERT ON public.admin_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.secure_admin_audit_insert();

-- 2. Fix security_logs RLS policies  
DROP POLICY IF EXISTS "System can insert security logs" ON public.security_logs;
DROP POLICY IF EXISTS "Users can view their own security logs" ON public.security_logs;
DROP POLICY IF EXISTS "Admins can view all security logs" ON public.security_logs;

-- Create secure RLS policies for security_logs
CREATE POLICY "Users can view their own security logs" ON public.security_logs
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Verified admins can view all security logs" ON public.security_logs
FOR SELECT USING (is_verified_admin('view_security_logs'));

CREATE POLICY "Authenticated users can insert own security logs" ON public.security_logs
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anonymous users can insert anonymous security logs" ON public.security_logs
FOR INSERT WITH CHECK (auth.uid() IS NULL AND user_id IS NULL);

-- Create trigger to ensure security log integrity
CREATE OR REPLACE FUNCTION public.secure_security_log_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- If authenticated user, force user_id to current user
  IF auth.uid() IS NOT NULL THEN
    NEW.user_id := auth.uid();
  ELSE
    -- For anonymous users, ensure user_id is null
    NEW.user_id := NULL;
  END IF;
  
  -- Ensure timestamp is set
  IF NEW.created_at IS NULL THEN
    NEW.created_at := now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER secure_security_log_trigger
  BEFORE INSERT ON public.security_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.secure_security_log_insert();

-- 3. Add constraint to prevent tampering with log timestamps
ALTER TABLE public.admin_audit_log 
ADD CONSTRAINT audit_log_timestamp_recent 
CHECK (timestamp >= (now() - INTERVAL '5 minutes'));

ALTER TABLE public.security_logs 
ADD CONSTRAINT security_log_timestamp_recent 
CHECK (created_at >= (now() - INTERVAL '5 minutes'));