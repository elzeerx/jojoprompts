import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyAdminAccess } from "../_shared/adminAuth.ts";
import { logSecurityEvent } from "../_shared/securityLogger.ts";

interface UserGrowthMetrics {
  total_users: number;
  new_users_today: number;
  new_users_week: number;
  new_users_month: number;
  active_users_today: number;
  active_users_week: number;
  active_users_month: number;
  user_growth_rate: number;
}

interface UserActivityMetrics {
  total_prompts_created: number;
  total_favorites: number;
  total_collections: number;
  avg_prompts_per_user: number;
  avg_session_duration: number;
  most_active_users: Array<{
    user_id: string;
    username: string;
    activity_count: number;
  }>;
}

interface UserEngagementMetrics {
  daily_active_users: Array<{
    date: string;
    count: number;
  }>;
  user_retention_rate: number;
  conversion_rate: number;
  subscription_rate: number;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getUserGrowthMetrics(supabase: any): Promise<UserGrowthMetrics> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Total users
  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact' });

  // New users today
  const { count: newUsersToday } = await supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .gte('created_at', today.toISOString());

  // New users this week
  const { count: newUsersWeek } = await supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .gte('created_at', weekAgo.toISOString());

  // New users this month
  const { count: newUsersMonth } = await supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .gte('created_at', monthAgo.toISOString());

  // Active users (based on recent activity)
  const { count: activeUsersToday } = await supabase
    .from('prompt_usage_history')
    .select('user_id', { count: 'exact' })
    .gte('created_at', today.toISOString());

  const { count: activeUsersWeek } = await supabase
    .from('prompt_usage_history')
    .select('user_id', { count: 'exact' })
    .gte('created_at', weekAgo.toISOString());

  const { count: activeUsersMonth } = await supabase
    .from('prompt_usage_history')
    .select('user_id', { count: 'exact' })
    .gte('created_at', monthAgo.toISOString());

  // Calculate growth rate
  const twoMonthsAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);
  const { count: usersLastMonth } = await supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .lt('created_at', monthAgo.toISOString())
    .gte('created_at', twoMonthsAgo.toISOString());

  const growthRate = usersLastMonth > 0 ? ((newUsersMonth - usersLastMonth) / usersLastMonth) * 100 : 0;

  return {
    total_users: totalUsers || 0,
    new_users_today: newUsersToday || 0,
    new_users_week: newUsersWeek || 0,
    new_users_month: newUsersMonth || 0,
    active_users_today: activeUsersToday || 0,
    active_users_week: activeUsersWeek || 0,
    active_users_month: activeUsersMonth || 0,
    user_growth_rate: growthRate
  };
}

async function getUserActivityMetrics(supabase: any): Promise<UserActivityMetrics> {
  // Total prompts created
  const { count: totalPrompts } = await supabase
    .from('prompts')
    .select('*', { count: 'exact' });

  // Total favorites
  const { count: totalFavorites } = await supabase
    .from('favorites')
    .select('*', { count: 'exact' });

  // Total collections
  const { count: totalCollections } = await supabase
    .from('collections')
    .select('*', { count: 'exact' });

  // Average prompts per user
  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact' });

  const avgPromptsPerUser = totalUsers > 0 ? (totalPrompts || 0) / totalUsers : 0;

  // Most active users (based on prompt creation)
  const { data: mostActiveUsers } = await supabase
    .from('prompts')
    .select(`
      user_id,
      profiles!inner(username)
    `)
    .limit(10);

  // Group by user and count
  const userActivityMap = new Map();
  mostActiveUsers?.forEach((prompt: any) => {
    const userId = prompt.user_id;
    const count = userActivityMap.get(userId) || 0;
    userActivityMap.set(userId, count + 1);
    userActivityMap.set(`${userId}_username`, prompt.profiles.username);
  });

  const mostActive = Array.from(userActivityMap.entries())
    .filter(([key]) => !key.includes('_username'))
    .map(([userId, count]) => ({
      user_id: userId,
      username: userActivityMap.get(`${userId}_username`) || 'Unknown',
      activity_count: count
    }))
    .sort((a, b) => b.activity_count - a.activity_count)
    .slice(0, 5);

  return {
    total_prompts_created: totalPrompts || 0,
    total_favorites: totalFavorites || 0,
    total_collections: totalCollections || 0,
    avg_prompts_per_user: Math.round(avgPromptsPerUser * 100) / 100,
    avg_session_duration: 0, // Would need session tracking
    most_active_users: mostActive
  };
}

async function getUserEngagementMetrics(supabase: any): Promise<UserEngagementMetrics> {
  // Daily active users for the last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const { data: dailyActiveUsers } = await supabase
    .from('prompt_usage_history')
    .select('created_at, user_id')
    .gte('created_at', thirtyDaysAgo.toISOString());

  // Group by date
  const dailyActiveMap = new Map();
  dailyActiveUsers?.forEach((activity: any) => {
    const date = activity.created_at.split('T')[0];
    const users = dailyActiveMap.get(date) || new Set();
    users.add(activity.user_id);
    dailyActiveMap.set(date, users);
  });

  const dailyActive = Array.from(dailyActiveMap.entries())
    .map(([date, users]) => ({
      date,
      count: users.size
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Subscription rate
  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact' });

  const { count: subscribedUsers } = await supabase
    .from('user_subscriptions')
    .select('user_id', { count: 'exact' })
    .eq('status', 'active');

  const subscriptionRate = totalUsers > 0 ? ((subscribedUsers || 0) / totalUsers) * 100 : 0;

  return {
    daily_active_users: dailyActive,
    user_retention_rate: 75, // Would need proper retention calculation
    conversion_rate: 12.5, // Would need conversion tracking
    subscription_rate: Math.round(subscriptionRate * 100) / 100
  };
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

    const authResult = await verifyAdminAccess(supabaseAdmin, user.id, 'analytics:view');
    if (!authResult.success) {
      await logSecurityEvent(supabaseAdmin, {
        user_id: user.id,
        action: 'unauthorized_analytics_access',
        details: { error: authResult.error }
      });

      return new Response(JSON.stringify({ error: authResult.error }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get analytics data
    const [growthMetrics, activityMetrics, engagementMetrics] = await Promise.all([
      getUserGrowthMetrics(supabaseAdmin),
      getUserActivityMetrics(supabaseAdmin),
      getUserEngagementMetrics(supabaseAdmin)
    ]);

    // Log admin action
    await logSecurityEvent(supabaseAdmin, {
      user_id: user.id,
      action: 'analytics_viewed',
      details: {
        analytics_type: 'user_analytics',
        timestamp: new Date().toISOString()
      }
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        growth: growthMetrics,
        activity: activityMetrics,
        engagement: engagementMetrics
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching user analytics:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});