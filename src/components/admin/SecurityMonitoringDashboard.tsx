import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, AlertTriangle, Activity, Eye, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface SecurityLog {
  id: string;
  action: string;
  user_id: string | null;
  user_agent: string | null;
  ip_address: string | null;
  details: any;
  created_at: string;
}

interface SecurityMetrics {
  totalEvents: number;
  unauthorizedAttempts: number;
  rateLimitViolations: number;
  suspiciousActivities: number;
  recentAlerts: SecurityLog[];
}

export function SecurityMonitoringDashboard() {
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);
  const [metrics, setMetrics] = useState<SecurityMetrics>({
    totalEvents: 0,
    unauthorizedAttempts: 0,
    rateLimitViolations: 0,
    suspiciousActivities: 0,
    recentAlerts: []
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSecurityLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('security_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setSecurityLogs(data || []);
      calculateMetrics(data || []);
    } catch (error) {
      console.error('Error fetching security logs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateMetrics = (logs: SecurityLog[]) => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentLogs = logs.filter(log => new Date(log.created_at) > oneDayAgo);
    
    const unauthorizedAttempts = recentLogs.filter(log => 
      log.action === 'unauthorized_access_attempt'
    ).length;

    const rateLimitViolations = recentLogs.filter(log => 
      log.action === 'rate_limit_exceeded'
    ).length;

    const suspiciousActivities = recentLogs.filter(log => 
      log.action === 'suspicious_activity'
    ).length;

    const recentAlerts = logs
      .filter(log => {
        const severity = log.details?.severity;
        return severity === 'high' || severity === 'medium';
      })
      .slice(0, 10);

    setMetrics({
      totalEvents: recentLogs.length,
      unauthorizedAttempts,
      rateLimitViolations,
      suspiciousActivities,
      recentAlerts
    });
  };

  const refreshData = async () => {
    setRefreshing(true);
    await fetchSecurityLogs();
  };

  useEffect(() => {
    fetchSecurityLogs();
    
    // Set up real-time subscription
    const subscription = supabase
      .channel('security_logs')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'security_logs'
      }, () => {
        fetchSecurityLogs();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'unauthorized_access_attempt':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'rate_limit_exceeded':
        return <Activity className="h-4 w-4 text-orange-500" />;
      case 'suspicious_activity':
        return <Eye className="h-4 w-4 text-yellow-500" />;
      default:
        return <Shield className="h-4 w-4 text-blue-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-warm-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-dark-base">Security Monitoring</h2>
          <p className="text-muted-foreground">Real-time security monitoring and alerts</p>
        </div>
        <Button 
          onClick={refreshData} 
          disabled={refreshing}
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Security Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events (24h)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalEvents}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unauthorized Attempts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{metrics.unauthorizedAttempts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rate Limit Violations</CardTitle>
            <Activity className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{metrics.rateLimitViolations}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspicious Activities</CardTitle>
            <Eye className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{metrics.suspiciousActivities}</div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {metrics.recentAlerts.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{metrics.recentAlerts.length} recent security alert(s)</strong> - 
            Review the security logs for details.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="logs">Security Logs</TabsTrigger>
          <TabsTrigger value="alerts">High Priority Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Security Events</CardTitle>
              <CardDescription>
                Latest security events and monitoring data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {securityLogs.map((log) => (
                    <div key={log.id} className="flex items-start space-x-3 p-3 rounded-lg border">
                      <div className="flex-shrink-0 mt-0.5">
                        {getActionIcon(log.action)}
                      </div>
                      <div className="flex-grow space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{log.action.replace(/_/g, ' ')}</span>
                          <div className="flex items-center space-x-2">
                            {log.details?.severity && (
                              <Badge variant={getSeverityColor(log.details.severity) as any}>
                                {log.details.severity}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(log.created_at), 'MMM dd, HH:mm:ss')}
                            </span>
                          </div>
                        </div>
                        {log.details?.path && (
                          <div className="text-xs text-muted-foreground">
                            Path: {log.details.path}
                          </div>
                        )}
                        {log.details?.reason && (
                          <div className="text-xs text-muted-foreground">
                            Reason: {log.details.reason}
                          </div>
                        )}
                        {log.user_id && (
                          <div className="text-xs text-muted-foreground">
                            User: {log.user_id}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {securityLogs.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No security events recorded yet
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>High Priority Security Alerts</CardTitle>
              <CardDescription>
                Critical security events requiring immediate attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {metrics.recentAlerts.map((alert) => (
                    <Alert key={alert.id} variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="space-y-2">
                        <div className="font-medium">{alert.action.replace(/_/g, ' ')}</div>
                        <div className="text-sm">
                          {alert.details?.reason || alert.details?.activity || 'Security alert triggered'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(alert.created_at), 'MMM dd, yyyy HH:mm:ss')}
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                  {metrics.recentAlerts.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No high priority alerts
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}