import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { 
  Users, 
  TrendingUp, 
  Activity, 
  Target, 
  Clock,
  Award,
  Loader2,
  RefreshCw
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';

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

interface AnalyticsData {
  growth: UserGrowthMetrics;
  activity: UserActivityMetrics;
  engagement: UserEngagementMetrics;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

export function UserAnalyticsDashboard() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const { data, error } = await supabase.functions.invoke('get-user-analytics');
      
      if (error) throw error;
      
      if (data?.success) {
        setAnalyticsData(data.data);
      } else {
        throw new Error(data?.error || 'Failed to fetch analytics');
      }
    } catch (error: any) {
      console.error('Error fetching user analytics:', error);
      toast({
        title: 'Error',
        description: 'Failed to load user analytics',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No analytics data available</p>
        <Button onClick={() => fetchAnalytics()} className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const { growth, activity, engagement } = analyticsData;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">User Analytics</h2>
          <p className="text-muted-foreground">Comprehensive user insights and metrics</p>
        </div>
        <Button 
          onClick={() => fetchAnalytics(true)}
          disabled={refreshing}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="growth" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="growth">Growth Metrics</TabsTrigger>
          <TabsTrigger value="activity">User Activity</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
        </TabsList>

        <TabsContent value="growth" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{growth.total_users.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  +{growth.new_users_month} this month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Growth Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {growth.user_growth_rate > 0 ? '+' : ''}{growth.user_growth_rate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">Monthly growth</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Today</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{growth.active_users_today}</div>
                <p className="text-xs text-muted-foreground">
                  {growth.active_users_week} this week
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">New Today</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{growth.new_users_today}</div>
                <p className="text-xs text-muted-foreground">
                  {growth.new_users_week} this week
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Daily Active Users (30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={engagement.daily_active_users}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="count" 
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary))" 
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Prompts</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activity.total_prompts_created.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Created by users</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Favorites</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activity.total_favorites.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Prompts favorited</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Collections</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activity.total_collections.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">User collections</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Prompts/User</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activity.avg_prompts_per_user.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">Per user average</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Most Active Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activity.most_active_users.map((user, index) => (
                  <div key={user.user_id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Badge variant={index === 0 ? 'default' : 'secondary'}>
                        #{index + 1}
                      </Badge>
                      <div>
                        <p className="font-medium">{user.username}</p>
                        <p className="text-sm text-muted-foreground">
                          {user.activity_count} prompts created
                        </p>
                      </div>
                    </div>
                    {index === 0 && <Award className="h-5 w-5 text-yellow-500" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Retention Rate</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{engagement.user_retention_rate}%</div>
                <p className="text-xs text-muted-foreground">30-day retention</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{engagement.conversion_rate}%</div>
                <p className="text-xs text-muted-foreground">Free to paid</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Subscription Rate</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{engagement.subscription_rate}%</div>
                <p className="text-xs text-muted-foreground">Active subscribers</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Engagement Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="text-sm font-medium mb-2">User Distribution</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Active', value: 68, color: COLORS[0] },
                          { name: 'Inactive', value: 22, color: COLORS[1] },
                          { name: 'New', value: 10, color: COLORS[2] }
                        ]}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                      >
                        {[
                          { name: 'Active', value: 68, color: COLORS[0] },
                          { name: 'Inactive', value: 22, color: COLORS[1] },
                          { name: 'New', value: 10, color: COLORS[2] }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-2">Activity Levels</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={[
                      { level: 'High', count: 145 },
                      { level: 'Medium', count: 289 },
                      { level: 'Low', count: 156 },
                      { level: 'Inactive', count: 67 }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="level" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}