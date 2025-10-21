-- Create user audit log table for tracking profile changes
CREATE TABLE IF NOT EXISTS public.user_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- The user whose profile was changed
  admin_user_id UUID NOT NULL, -- The admin who made the change
  action TEXT NOT NULL, -- Type of action (update_profile, update_email, etc.)
  field_name TEXT, -- Specific field that was changed
  old_value JSONB, -- Previous value
  new_value JSONB, -- New value
  metadata JSONB DEFAULT '{}', -- Additional context
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for user audit log
CREATE POLICY "Verified admins can view audit logs" 
ON public.user_audit_log 
FOR SELECT 
USING (is_verified_admin('view_user_audit_logs'));

CREATE POLICY "System functions can insert audit logs" 
ON public.user_audit_log 
FOR INSERT 
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_audit_log_user_id ON public.user_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_audit_log_admin_user_id ON public.user_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_user_audit_log_timestamp ON public.user_audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_audit_log_action ON public.user_audit_log(action);

-- Create bulk operations log table for tracking bulk actions
CREATE TABLE IF NOT EXISTS public.bulk_operations_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  operation_type TEXT NOT NULL, -- bulk_update, bulk_delete, bulk_export
  affected_users INTEGER DEFAULT 0,
  parameters JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending', -- pending, completed, failed
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bulk_operations_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for bulk operations log
CREATE POLICY "Verified admins can view bulk operations" 
ON public.bulk_operations_log 
FOR SELECT 
USING (is_verified_admin('view_bulk_operations'));

CREATE POLICY "Verified admins can insert bulk operations" 
ON public.bulk_operations_log 
FOR INSERT 
WITH CHECK (is_verified_admin('create_bulk_operations'));

CREATE POLICY "Verified admins can update bulk operations" 
ON public.bulk_operations_log 
FOR UPDATE 
USING (is_verified_admin('update_bulk_operations'));

-- Create function to log user profile changes
CREATE OR REPLACE FUNCTION public.log_user_profile_change(
  target_user_id UUID,
  admin_id UUID,
  action_type TEXT,
  field_name TEXT DEFAULT NULL,
  old_val JSONB DEFAULT NULL,
  new_val JSONB DEFAULT NULL,
  additional_metadata JSONB DEFAULT '{}',
  client_ip TEXT DEFAULT NULL,
  client_user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_audit_log (
    user_id,
    admin_user_id,
    action,
    field_name,
    old_value,
    new_value,
    metadata,
    ip_address,
    user_agent
  ) VALUES (
    target_user_id,
    admin_id,
    action_type,
    field_name,
    old_val,
    new_val,
    additional_metadata,
    client_ip,
    client_user_agent
  );
END;
$$;

-- Create function to get user activity timeline
CREATE OR REPLACE FUNCTION public.get_user_activity_timeline(
  target_user_id UUID,
  page_size INTEGER DEFAULT 20,
  page_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  action TEXT,
  field_name TEXT,
  old_value JSONB,
  new_value JSONB,
  admin_first_name TEXT,
  admin_last_name TEXT,
  admin_username TEXT,
  timestamp TIMESTAMPTZ,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Security check: only verified admins can view activity timeline
  IF NOT is_verified_admin('view_user_activity') THEN
    RAISE EXCEPTION 'Access denied: Admin verification required';
  END IF;

  RETURN QUERY
  SELECT 
    ual.id,
    ual.action,
    ual.field_name,
    ual.old_value,
    ual.new_value,
    p.first_name as admin_first_name,
    p.last_name as admin_last_name,
    p.username as admin_username,
    ual.timestamp,
    ual.metadata
  FROM public.user_audit_log ual
  LEFT JOIN public.profiles p ON p.id = ual.admin_user_id
  WHERE ual.user_id = target_user_id
  ORDER BY ual.timestamp DESC
  LIMIT page_size
  OFFSET page_offset;
END;
$$;