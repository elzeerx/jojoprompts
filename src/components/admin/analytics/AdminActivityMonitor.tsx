import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { 
  Shield, 
  Activity, 
  Clock, 
  User,
  AlertTriangle,
  CheckCircle,
  Loader2,
  RefreshCw,
  Calendar
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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

export function AdminActivityMonitor() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [realtimeActivities, setRealtimeActivities] = useState<AdminActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [realtimeLoading, setRealtimeLoading] = useState(false);
  const [lastTimestamp, setLastTimestamp] = useState<string>('');

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-activity-monitor', {
        body: { action: 'stats' }
      });
      
      if (error) throw error;
      
      if (data?.success) {
        setStats(data.data);
        if (data.data.recent_activities.length > 0) {
          setLastTimestamp(data.data.recent_activities[0].timestamp);
        }
      } else {
        throw new Error(data?.error || 'Failed to fetch admin stats');
      }
    } catch (error: any) {
      console.error('Error fetching admin stats:', error);
      toast({
        title: 'Error',
        description: 'Failed to load admin activity stats',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRealtimeActivities = async () => {
    if (!lastTimestamp) return;
    
    setRealtimeLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-activity-monitor', {
        body: { 
          action: 'realtime',
          lastTimestamp 
        }
      });
      
      if (error) throw error;
      
      if (data?.success && data.data.length > 0) {
        setRealtimeActivities(prev => [...data.data, ...prev].slice(0, 20));
        setLastTimestamp(data.data[0].timestamp);
      }
    } catch (error: any) {
      console.error('Error fetching realtime activities:', error);
    } finally {
      setRealtimeLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Set up periodic refresh for realtime activities
    const interval = setInterval(fetchRealtimeActivities, 10000); // Every 10 seconds
    
    return () => clearInterval(interval);
  }, [lastTimestamp]);

  const getActionIcon = (action: string) => {
    if (action.includes('security') || action.includes('auth')) {
      return <Shield className="h-4 w-4 text-red-500" />;
    }
    if (action.includes('create') || action.includes('add')) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    if (action.includes('delete') || action.includes('remove')) {
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    }
    return <Activity className="h-4 w-4 text-blue-500" />;
  };

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('security') || action.includes('delete')) {
      return 'destructive' as const;
    }
    if (action.includes('create') || action.includes('add')) {
      return 'default' as const;
    }
    return 'secondary' as const;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No admin activity data available</p>
        <Button onClick={fetchStats} className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const allActivities = [...realtimeActivities, ...stats.recent_activities]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Admin Activity Monitor</h2>
          <p className="text-muted-foreground">Real-time admin actions and system security</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={fetchRealtimeActivities}
            disabled={realtimeLoading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${realtimeLoading ? 'animate-spin' : ''}`} />
            Live Update
          </Button>
          <Button 
            onClick={fetchStats}
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actions Today</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_actions_today}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total_actions_week} this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Admins</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.most_active_admins.length}</div>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Events</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.action_breakdown.filter(a => a.action_type.includes('security')).reduce((sum, a) => sum + a.count, 0)}
            </div>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Live Updates</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{realtimeActivities.length}</div>
            <p className="text-xs text-muted-foreground">New since refresh</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Most Active Admins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.most_active_admins.map((admin, index) => (
                <div key={admin.admin_id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Badge variant={index === 0 ? 'default' : 'secondary'}>
                      #{index + 1}
                    </Badge>
                    <div>
                      <p className="font-medium">{admin.username}</p>
                      <p className="text-sm text-muted-foreground">
                        {admin.action_count} actions
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Action Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.action_breakdown.slice(0, 5).map((action) => (
                <div key={action.action_type} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getActionIcon(action.action_type)}
                    <span className="text-sm">{action.action_type.replace(/_/g, ' ')}</span>
                  </div>
                  <Badge variant="outline">{action.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Live Activity Feed
            {realtimeActivities.length > 0 && (
              <Badge variant="outline" className="ml-auto">
                {realtimeActivities.length} new
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {allActivities.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3 p-3 rounded-lg border">
                  {getActionIcon(activity.action)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium">
                          {activity.admin_profile?.username || 'Unknown Admin'}
                        </p>
                        <Badge variant={getActionBadgeVariant(activity.action)}>
                          {activity.action.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Target: {activity.target_resource}
                    </p>
                    {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                      <div className="mt-2 text-xs">
                        <details className="cursor-pointer">
                          <summary className="text-muted-foreground hover:text-foreground">
                            View details
                          </summary>
                          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                            {JSON.stringify(activity.metadata, null, 2)}
                          </pre>
                        </details>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}