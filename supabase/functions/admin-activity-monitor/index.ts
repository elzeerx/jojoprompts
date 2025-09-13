import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyAdminAccess } from "../_shared/adminAuth.ts";
import { logSecurityEvent } from "../_shared/securityLogger.ts";

interface AdminActivity {
  id: string;
  admin_user_id: string;
  action: string;
  target_resource: string;
  metadata: any;
  timestamp: string;
  admin_profile?: {
    username: string;
    first_name: string;
    last_name: string;
  };
}

interface AdminStats {
  total_actions_today: number;
  total_actions_week: number;
  most_active_admins: Array<{
    admin_id: string;
    username: string;
    action_count: number;
  }>;
  recent_activities: AdminActivity[];
  action_breakdown: Array<{
    action_type: string;
    count: number;
  }>;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getAdminActivityStats(supabase: any): Promise<AdminStats> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Get total actions today
  const { count: actionsToday } = await supabase
    .from('admin_audit_log')
    .select('*', { count: 'exact' })
    .gte('timestamp', today.toISOString());

  // Get total actions this week
  const { count: actionsWeek } = await supabase
    .from('admin_audit_log')
    .select('*', { count: 'exact' })
    .gte('timestamp', weekAgo.toISOString());

  // Get recent activities with admin profiles
  const { data: recentActivities } = await supabase
    .from('admin_audit_log')
    .select(`
      *,
      profiles!admin_user_id(username, first_name, last_name)
    `)
    .order('timestamp', { ascending: false })
    .limit(50);

  // Get most active admins this week
  const { data: adminActivities } = await supabase
    .from('admin_audit_log')
    .select(`
      admin_user_id,
      profiles!admin_user_id(username)
    `)
    .gte('timestamp', weekAgo.toISOString());

  // Count activities per admin
  const adminActivityMap = new Map();
  adminActivities?.forEach((activity: any) => {
    const adminId = activity.admin_user_id;
    const count = adminActivityMap.get(adminId) || 0;
    adminActivityMap.set(adminId, count + 1);
    if (activity.profiles) {
      adminActivityMap.set(`${adminId}_username`, activity.profiles.username);
    }
  });

  const mostActiveAdmins = Array.from(adminActivityMap.entries())
    .filter(([key]) => !key.includes('_username'))
    .map(([adminId, count]) => ({
      admin_id: adminId,
      username: adminActivityMap.get(`${adminId}_username`) || 'Unknown',
      action_count: count
    }))
    .sort((a, b) => b.action_count - a.action_count)
    .slice(0, 5);

  // Get action breakdown
  const { data: actionBreakdown } = await supabase
    .from('admin_audit_log')
    .select('action')
    .gte('timestamp', weekAgo.toISOString());

  const actionCountMap = new Map();
  actionBreakdown?.forEach((activity: any) => {
    const action = activity.action;
    const count = actionCountMap.get(action) || 0;
    actionCountMap.set(action, count + 1);
  });

  const actionBreakdownArray = Array.from(actionCountMap.entries())
    .map(([action, count]) => ({
      action_type: action,
      count: count
    }))
    .sort((a, b) => b.count - a.count);

  return {
    total_actions_today: actionsToday || 0,
    total_actions_week: actionsWeek || 0,
    most_active_admins: mostActiveAdmins,
    recent_activities: recentActivities?.map((activity: any) => ({
      ...activity,
      admin_profile: activity.profiles
    })) || [],
    action_breakdown: actionBreakdownArray
  };
}

async function getRealtimeAdminActivity(supabase: any, lastTimestamp?: string) {
  const query = supabase
    .from('admin_audit_log')
    .select(`
      *,
      profiles!admin_user_id(username, first_name, last_name)
    `)
    .order('timestamp', { ascending: false })
    .limit(20);

  if (lastTimestamp) {
    query.gt('timestamp', lastTimestamp);
  }

  const { data } = await query;

  return data?.map((activity: any) => ({
    ...activity,
    admin_profile: activity.profiles
  })) || [];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin access
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(authHeader);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const authResult = await verifyAdminAccess(supabaseAdmin, user.id, 'admin:monitor');
    if (!authResult.success) {
      await logSecurityEvent(supabaseAdmin, {
        user_id: user.id,
        action: 'unauthorized_admin_monitor_access',
        details: { error: authResult.error }
      });

      return new Response(JSON.stringify({ error: authResult.error }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const lastTimestamp = url.searchParams.get('lastTimestamp');

    let responseData;

    switch (action) {
      case 'realtime':
        responseData = await getRealtimeAdminActivity(supabaseAdmin, lastTimestamp || undefined);
        break;
      case 'stats':
      default:
        responseData = await getAdminActivityStats(supabaseAdmin);
        break;
    }

    // Log admin action
    await logSecurityEvent(supabaseAdmin, {
      user_id: user.id,
      action: 'admin_activity_monitored',
      details: {
        monitoring_action: action || 'stats',
        timestamp: new Date().toISOString()
      }
    });

    return new Response(JSON.stringify({
      success: true,
      data: responseData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching admin activity:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});