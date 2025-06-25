
import { useEffect, useState } from "react";
import { FileText, Users, Activity, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { EnhancedErrorHandler } from "@/utils/enhancedErrorHandler";

interface Stats {
  prompts: number;
  users: number;
  signups: number;
  aiRuns: number;
}

interface ActivityItem {
  id: string;
  description: string;
  timestamp: string;
  user_email?: string;
}

export default function EnhancedDashboardOverview() {
  const [stats, setStats] = useState<Stats>({
    prompts: 0,
    users: 0,
    signups: 0,
    aiRuns: 0,
  });
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user, session, userRole } = useAuth();
  const { trackActivity } = useActivityTracker();

  const hasAdminAccess = userRole === 'admin';

  useEffect(() => {
    if (!hasAdminAccess) {
      setError("Admin access required to view dashboard statistics");
      setLoading(false);
      return;
    }

    if (!session?.access_token) {
      setError("Authentication required. Please refresh the page and try again.");
      setLoading(false);
      return;
    }

    fetchDashboardData();
    
    // Set up real-time listeners for data updates with debouncing
    let updateTimeout: NodeJS.Timeout;
    
    const promptsChannel = supabase
      .channel('dashboard-prompts-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'prompts' },
        () => {
          clearTimeout(updateTimeout);
          updateTimeout = setTimeout(() => {
            console.log('Prompts data changed, refreshing stats');
            fetchDashboardData();
          }, 1000); // Debounce updates by 1 second
        }
      )
      .subscribe();
      
    const profilesChannel = supabase
      .channel('dashboard-profiles-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          clearTimeout(updateTimeout);
          updateTimeout = setTimeout(() => {
            console.log('Profiles data changed, refreshing stats');
            fetchDashboardData();
          }, 1000);
        }
      )
      .subscribe();
      
    return () => {
      clearTimeout(updateTimeout);
      supabase.removeChannel(promptsChannel);
      supabase.removeChannel(profilesChannel);
    };
  }, [session, hasAdminAccess]);

  const fetchDashboardData = async () => {
    if (!hasAdminAccess) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('Starting dashboard data fetch...');
      
      const [statsResult, activityResult] = await Promise.allSettled([
        fetchStats(),
        fetchRecentActivity()
      ]);

      if (statsResult.status === 'fulfilled') {
        setStats(statsResult.value);
      } else {
        throw new Error(`Failed to fetch statistics: ${statsResult.reason.message}`);
      }

      if (activityResult.status === 'fulfilled') {
        setRecentActivity(activityResult.value);
      } else {
        console.warn('Activity fetch failed:', activityResult.reason);
        setRecentActivity([]);
      }

      console.log('Dashboard data fetch completed successfully');
      
    } catch (error: any) {
      const handledError = EnhancedErrorHandler.handle(error, {
        component: 'DashboardOverview',
        action: 'fetch_dashboard_data',
        userId: user?.id
      });
      
      setError(handledError.message);
      
      // Track error for analytics
      trackActivity('error_occurred', {
        error_type: 'dashboard_fetch_failed',
        error_message: handledError.message,
        recoverable: handledError.recoverable
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    try {
      setIsRefreshing(true);
      await fetchDashboardData();
      trackActivity('admin_action', { action: 'manual_refresh', context: 'dashboard' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchStats = async (): Promise<Stats> => {
    console.log('Fetching statistics...');
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Query timeout')), 10000);
    });

    const promptsPromise = supabase
      .from("prompts")
      .select("*", { count: 'exact', head: true });
    
    const promptsResult = await Promise.race([promptsPromise, timeoutPromise]) as any;
    
    if (promptsResult.error) {
      throw new Error(`Prompts query failed: ${promptsResult.error.message}`);
    }

    const usersPromise = supabase
      .from('profiles')
      .select("*", { count: 'exact', head: true });
    
    const usersResult = await Promise.race([usersPromise, timeoutPromise]) as any;
    
    if (usersResult.error) {
      throw new Error(`Users query failed: ${usersResult.error.message}`);
    }
    
    const newStats = {
      prompts: promptsResult.count || 0,
      users: usersResult.count || 0,
      signups: usersResult.count || 0,
      aiRuns: 0
    };

    console.log('Stats fetched successfully:', newStats);
    return newStats;
  };

  const fetchRecentActivity = async (): Promise<ActivityItem[]> => {
    console.log('Fetching recent activity...');
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Activity query timeout')), 8000);
    });

    const activityPromise = supabase
      .from("prompts")
      .select(`
        id,
        title,
        created_at,
        user_id,
        profiles!inner(first_name, last_name)
      `)
      .order('created_at', { ascending: false })
      .limit(5);
    
    const activityResult = await Promise.race([activityPromise, timeoutPromise]) as any;
    
    if (activityResult.error) {
      throw new Error(`Activity query failed: ${activityResult.error.message}`);
    }
    
    const activityData = activityResult.data || [];
    
    const formattedActivity: ActivityItem[] = activityData.map((item: any) => {
      const userName = item.profiles?.first_name 
        ? `${item.profiles.first_name} ${item.profiles.last_name || ''}`.trim()
        : 'Unknown user';

      return {
        id: item.id,
        description: `New prompt created: "${item.title}"`,
        timestamp: item.created_at,
        user_email: userName
      };
    });
    
    console.log('Activity formatted successfully:', formattedActivity);
    return formattedActivity;
  };

  if (!hasAdminAccess) {
    return (
      <div className="flex items-center justify-center py-8">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Access Denied</h3>
              <p className="text-muted-foreground">
                You need admin privileges to access the dashboard.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cards = [
    {
      title: "Total Prompts",
      value: stats.prompts,
      icon: FileText,
    },
    {
      title: "Total Users",
      value: stats.users,
      icon: Users,
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard Overview</h2>
          <p className="text-muted-foreground">
            System statistics and recent activity
          </p>
        </div>
        <Button
          onClick={handleManualRefresh}
          disabled={loading || isRefreshing}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-red-800 mb-1">
                  Dashboard Loading Error
                </h4>
                <p className="text-sm text-red-700 mb-3">{error}</p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleManualRefresh}
                  disabled={loading || isRefreshing}
                  className="text-red-700 border-red-300 hover:bg-red-100"
                >
                  {loading || isRefreshing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Retrying...
                    </>
                  ) : (
                    'Retry'
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} className="border-warm-gold/20 bg-white/95 shadow-sm hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-warm-gold/10 via-transparent to-muted-teal/10">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-warm-gold" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-dark-base">
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-warm-gold" />
                ) : (
                  <span>{card.value}</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 border-warm-gold/20 bg-white/95 shadow-sm hover:shadow-md transition-all">
          <CardHeader className="bg-gradient-to-r from-warm-gold/10 via-transparent to-muted-teal/10">
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest user actions and system events</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-warm-gold" />
              </div>
            ) : recentActivity.length > 0 ? (
              <ul className="space-y-4">
                {recentActivity.map((item) => (
                  <li key={item.id} className="flex items-start gap-2 border-b border-warm-gold/10 pb-3 last:border-0">
                    <Activity className="h-5 w-5 text-warm-gold mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{item.description}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>{new Date(item.timestamp).toLocaleString()}</span>
                        {item.user_email && <span>by {item.user_email}</span>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-center py-4">No activity yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
