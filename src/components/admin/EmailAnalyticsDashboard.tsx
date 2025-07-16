import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Mail, TrendingUp, AlertTriangle, CheckCircle, Clock, XCircle, Apple, BarChart3 } from 'lucide-react';
import { EmailMonitoringAlerts } from './EmailMonitoringAlerts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';

interface EmailMetrics {
  totalEmails: number;
  successfulEmails: number;
  failedEmails: number;
  pendingEmails: number;
  appleSuccessRate: number;
  otherSuccessRate: number;
  bounceRate: number;
  retryRate: number;
}

interface DomainStats {
  domain_type: string;
  total: number;
  successful: number;
  failed: number;
  success_rate: number;
}

interface EmailLog {
  id: string;
  email_address: string;
  email_type: string;
  domain_type: string;
  delivery_status: string;
  bounce_reason: string | null;
  retry_count: number;
  attempted_at: string;
  success: boolean;
}

const COLORS = ['hsl(var(--warm-gold))', 'hsl(var(--muted-teal))', 'hsl(var(--destructive))', 'hsl(var(--muted))'];

export function EmailAnalyticsDashboard() {
  const { isAdmin } = useAuth();
  const [metrics, setMetrics] = useState<EmailMetrics>({
    totalEmails: 0,
    successfulEmails: 0,
    failedEmails: 0,
    pendingEmails: 0,
    appleSuccessRate: 0,
    otherSuccessRate: 0,
    bounceRate: 0,
    retryRate: 0
  });
  const [domainStats, setDomainStats] = useState<DomainStats[]>([]);
  const [recentLogs, setRecentLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<string>('24h');
  const [emailTypeFilter, setEmailTypeFilter] = useState<string>('all');

  if (!isAdmin) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Administrative privileges required to access email analytics.
        </AlertDescription>
      </Alert>
    );
  }

  useEffect(() => {
    loadEmailAnalytics();
  }, [timeRange, emailTypeFilter]);

  const getTimeRangeHours = (range: string): number => {
    switch (range) {
      case '1h': return 1;
      case '24h': return 24;
      case '7d': return 168;
      case '30d': return 720;
      default: return 24;
    }
  };

  const loadEmailAnalytics = async () => {
    try {
      setLoading(true);
      const hoursAgo = getTimeRangeHours(timeRange);
      const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

      // Build query with filters
      let query = supabase
        .from('email_logs')
        .select('*')
        .gte('attempted_at', cutoffTime)
        .order('attempted_at', { ascending: false });

      if (emailTypeFilter !== 'all') {
        query = query.eq('email_type', emailTypeFilter);
      }

      const { data: emailLogs, error } = await query.limit(1000);

      if (error) {
        console.error('Error loading email logs:', error);
        return;
      }

      if (emailLogs) {
        processEmailMetrics(emailLogs);
        setRecentLogs(emailLogs.slice(0, 20));
      }
    } catch (error) {
      console.error('Error loading email analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const processEmailMetrics = (logs: EmailLog[]) => {
    const total = logs.length;
    const successful = logs.filter(log => log.success).length;
    const failed = logs.filter(log => !log.success && log.delivery_status !== 'pending').length;
    const pending = logs.filter(log => log.delivery_status === 'pending').length;
    const bounced = logs.filter(log => log.bounce_reason).length;
    const retried = logs.filter(log => log.retry_count > 0).length;

    // Apple domain analysis
    const appleLogs = logs.filter(log => log.domain_type === 'apple');
    const otherLogs = logs.filter(log => log.domain_type !== 'apple');
    
    const appleSuccessful = appleLogs.filter(log => log.success).length;
    const otherSuccessful = otherLogs.filter(log => log.success).length;

    const appleSuccessRate = appleLogs.length > 0 ? (appleSuccessful / appleLogs.length) * 100 : 0;
    const otherSuccessRate = otherLogs.length > 0 ? (otherSuccessful / otherLogs.length) * 100 : 0;

    setMetrics({
      totalEmails: total,
      successfulEmails: successful,
      failedEmails: failed,
      pendingEmails: pending,
      appleSuccessRate,
      otherSuccessRate,
      bounceRate: total > 0 ? (bounced / total) * 100 : 0,
      retryRate: total > 0 ? (retried / total) * 100 : 0
    });

    // Domain statistics
    const domainMap = new Map<string, { total: number; successful: number; failed: number }>();
    
    logs.forEach(log => {
      const domain = log.domain_type || 'unknown';
      if (!domainMap.has(domain)) {
        domainMap.set(domain, { total: 0, successful: 0, failed: 0 });
      }
      
      const stats = domainMap.get(domain)!;
      stats.total++;
      if (log.success) stats.successful++;
      else if (log.delivery_status !== 'pending') stats.failed++;
    });

    const domainStatsArray: DomainStats[] = Array.from(domainMap.entries()).map(([domain, stats]) => ({
      domain_type: domain,
      total: stats.total,
      successful: stats.successful,
      failed: stats.failed,
      success_rate: stats.total > 0 ? (stats.successful / stats.total) * 100 : 0
    }));

    setDomainStats(domainStatsArray.sort((a, b) => b.total - a.total));
  };

  const getStatusIcon = (status: string, success: boolean) => {
    if (success) return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (status === 'pending') return <Clock className="h-4 w-4 text-yellow-600" />;
    return <XCircle className="h-4 w-4 text-red-600" />;
  };

  const getStatusBadge = (status: string, success: boolean) => {
    if (success) return <Badge variant="default" className="bg-green-100 text-green-800">Success</Badge>;
    if (status === 'pending') return <Badge variant="secondary">Pending</Badge>;
    return <Badge variant="destructive">Failed</Badge>;
  };

  const pieChartData = [
    { name: 'Successful', value: metrics.successfulEmails, color: 'hsl(var(--warm-gold))' },
    { name: 'Failed', value: metrics.failedEmails, color: 'hsl(var(--destructive))' },
    { name: 'Pending', value: metrics.pendingEmails, color: 'hsl(var(--muted))' }
  ];

  const renderAnalyticsDashboard = () => {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div>
            <h3 className="text-xl font-bold tracking-tight">Email Analytics</h3>
            <p className="text-muted-foreground">
              Monitor email delivery performance and domain-specific metrics
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>

            <Select value={emailTypeFilter} onValueChange={setEmailTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Email type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="confirmation">Confirmation</SelectItem>
                <SelectItem value="password-reset">Password Reset</SelectItem>
                <SelectItem value="welcome">Welcome</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={loadEmailAnalytics} disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Emails</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalEmails}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overall Success Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {metrics.totalEmails > 0 ? ((metrics.successfulEmails / metrics.totalEmails) * 100).toFixed(1) : 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                {metrics.successfulEmails} successful
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Apple Success Rate</CardTitle>
              <Apple className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${metrics.appleSuccessRate < 80 ? 'text-red-600' : 'text-green-600'}`}>
                {metrics.appleSuccessRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Apple domains (@icloud, @me, @mac)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bounce Rate</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {metrics.bounceRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Emails bounced
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Success Rate by Domain Type</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={domainStats}>
                    <XAxis dataKey="domain_type" />
                    <YAxis />
                    <Bar dataKey="success_rate" fill="hsl(var(--warm-gold))" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Domain Statistics Table */}
        <Card>
          <CardHeader>
            <CardTitle>Domain Performance Summary</CardTitle>
            <CardDescription>Email delivery statistics by domain type</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain Type</TableHead>
                  <TableHead>Total Emails</TableHead>
                  <TableHead>Successful</TableHead>
                  <TableHead>Failed</TableHead>
                  <TableHead>Success Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domainStats.map((stat) => (
                  <TableRow key={stat.domain_type}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {stat.domain_type === 'apple' && <Apple className="h-4 w-4" />}
                        <span className="capitalize">{stat.domain_type}</span>
                        {stat.domain_type === 'apple' && (
                          <Badge variant="outline" className="text-xs">Enhanced</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{stat.total}</TableCell>
                    <TableCell className="text-green-600">{stat.successful}</TableCell>
                    <TableCell className="text-red-600">{stat.failed}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={stat.success_rate >= 80 ? "default" : stat.success_rate >= 60 ? "secondary" : "destructive"}
                      >
                        {stat.success_rate.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Email Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Email Activity</CardTitle>
            <CardDescription>Last 20 email delivery attempts</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Retries</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Bounce Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(log.delivery_status, log.success)}
                        {getStatusBadge(log.delivery_status, log.success)}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {log.email_address.length > 25 
                        ? `${log.email_address.substring(0, 25)}...` 
                        : log.email_address}
                    </TableCell>
                    <TableCell>{log.email_type}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {log.domain_type === 'apple' && <Apple className="h-4 w-4" />}
                        <Badge variant="outline" className="capitalize">
                          {log.domain_type}
                        </Badge>
                        {log.domain_type === 'apple' && (
                          <Badge variant="outline" className="text-xs">Enhanced</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.retry_count > 0 ? (
                        <Badge variant="secondary">{log.retry_count}</Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(log.attempted_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.bounce_reason ? (
                        <span className="text-red-600">{log.bounce_reason}</span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <Tabs defaultValue="analytics" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Email Management</h2>
          <p className="text-muted-foreground">
            Monitor email delivery performance and configure alerts
          </p>
        </div>
      </div>

      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="analytics" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Analytics
        </TabsTrigger>
        <TabsTrigger value="alerts" className="flex items-center gap-2">
          <Apple className="h-4 w-4" />
          Monitoring & Alerts
        </TabsTrigger>
      </TabsList>

      <TabsContent value="analytics" className="space-y-6">
        {renderAnalyticsDashboard()}
      </TabsContent>

      <TabsContent value="alerts" className="space-y-6">
        <EmailMonitoringAlerts />
      </TabsContent>
    </Tabs>
  );
}