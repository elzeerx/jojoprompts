import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, CheckCircle, Bell, BellOff, Apple, Mail } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface AlertRule {
  id: string;
  domain_type: string;
  alert_type: 'success_rate' | 'bounce_rate' | 'volume';
  threshold: number;
  time_window: string;
  enabled: boolean;
  last_triggered?: string;
}

interface RecentAlert {
  id: string;
  action: string;
  created_at: string;
  details: {
    domain_type: string;
    success_rate?: number;
    alert_level: 'warning' | 'critical';
    total_emails: number;
    successful_emails: number;
  };
}

const DEFAULT_ALERT_RULES: Omit<AlertRule, 'id'>[] = [
  {
    domain_type: 'apple',
    alert_type: 'success_rate',
    threshold: 70,
    time_window: '1_hour',
    enabled: true
  },
  {
    domain_type: 'apple',
    alert_type: 'success_rate',
    threshold: 85,
    time_window: '1_hour',
    enabled: true
  },
  {
    domain_type: 'gmail',
    alert_type: 'success_rate',
    threshold: 80,
    time_window: '1_hour',
    enabled: true
  },
  {
    domain_type: 'outlook',
    alert_type: 'success_rate',
    threshold: 80,
    time_window: '1_hour',
    enabled: true
  },
  {
    domain_type: 'other',
    alert_type: 'success_rate',
    threshold: 75,
    time_window: '1_hour',
    enabled: true
  }
];

export function EmailMonitoringAlerts() {
  const { isAdmin } = useAuth();
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<RecentAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingAlert, setTestingAlert] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Administrative privileges required to access email monitoring alerts.
        </AlertDescription>
      </Alert>
    );
  }

  useEffect(() => {
    loadAlertData();
    
    // Set up real-time subscription for new alerts
    const alertsSubscription = supabase
      .channel('security_logs_alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'security_logs',
          filter: 'action.in.(email_delivery_warning,email_delivery_critical_failure)'
        },
        (payload) => {
          console.log('New email alert received:', payload);
          loadRecentAlerts(); // Refresh alerts
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(alertsSubscription);
    };
  }, []);

  const loadAlertData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadAlertRules(),
        loadRecentAlerts()
      ]);
    } catch (error) {
      console.error('Error loading alert data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAlertRules = async () => {
    // For now, use default rules - in production you'd store these in database
    const rules = DEFAULT_ALERT_RULES.map((rule, index) => ({
      ...rule,
      id: `rule_${index}`
    }));
    setAlertRules(rules);
  };

  const loadRecentAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('security_logs')
        .select('*')
        .in('action', ['email_delivery_warning', 'email_delivery_critical_failure'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error loading recent alerts:', error);
        return;
      }

      setRecentAlerts((data || []).map(item => ({
        ...item,
        details: item.details as RecentAlert['details']
      })));
    } catch (error) {
      console.error('Error loading recent alerts:', error);
    }
  };

  const toggleAlertRule = async (ruleId: string, enabled: boolean) => {
    setAlertRules(prev => 
      prev.map(rule => 
        rule.id === ruleId ? { ...rule, enabled } : rule
      )
    );
    
    // In production, you'd save this to database
    console.log(`Alert rule ${ruleId} ${enabled ? 'enabled' : 'disabled'}`);
  };

  const testAlert = async (domainType: string) => {
    setTestingAlert(domainType);
    
    try {
      // Trigger a test alert by logging to security_logs
      const { error } = await supabase
        .from('security_logs')
        .insert([{
          action: 'email_delivery_warning',
          details: {
            domain_type: domainType,
            success_rate: 75,
            total_emails: 10,
            successful_emails: 7,
            time_window: '1_hour',
            alert_level: 'warning',
            test_alert: true
          }
        }]);

      if (error) {
        console.error('Error creating test alert:', error);
      } else {
        console.log(`Test alert created for ${domainType} domain`);
        // Refresh alerts after a short delay
        setTimeout(loadRecentAlerts, 1000);
      }
    } catch (error) {
      console.error('Error testing alert:', error);
    } finally {
      setTestingAlert(null);
    }
  };

  const getAlertIcon = (alertLevel: string) => {
    return alertLevel === 'critical' 
      ? <AlertTriangle className="h-4 w-4 text-red-600" />
      : <AlertTriangle className="h-4 w-4 text-yellow-600" />;
  };

  const getAlertBadge = (alertLevel: string) => {
    return alertLevel === 'critical'
      ? <Badge variant="destructive">Critical</Badge>
      : <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Warning</Badge>;
  };

  const getDomainIcon = (domainType: string) => {
    if (domainType === 'apple') return <Apple className="h-4 w-4" />;
    return <Mail className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Email Monitoring & Alerts</h2>
          <p className="text-muted-foreground">
            Configure and monitor email delivery alerts for different domain types
          </p>
        </div>
        
        <Button onClick={loadAlertData} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      {/* Alert Rules Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alert Rules Configuration
          </CardTitle>
          <CardDescription>
            Configure automatic alerts for email delivery issues by domain type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain Type</TableHead>
                <TableHead>Alert Type</TableHead>
                <TableHead>Threshold</TableHead>
                <TableHead>Time Window</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alertRules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getDomainIcon(rule.domain_type)}
                      <span className="capitalize font-medium">{rule.domain_type}</span>
                      {rule.domain_type === 'apple' && (
                        <Badge variant="outline" className="text-xs">Enhanced</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{rule.alert_type.replace('_', ' ')}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono">
                      {rule.threshold}%
                    </span>
                  </TableCell>
                  <TableCell>{rule.time_window.replace('_', ' ')}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {rule.enabled ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <BellOff className="h-4 w-4 text-gray-400" />
                      )}
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(enabled) => toggleAlertRule(rule.id, enabled)}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testAlert(rule.domain_type)}
                      disabled={testingAlert === rule.domain_type}
                    >
                      {testingAlert === rule.domain_type ? 'Testing...' : 'Test Alert'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Apple Domain Special Handling Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Apple className="h-5 w-5" />
            Apple Domain Enhanced Delivery
          </CardTitle>
          <CardDescription>
            Special optimizations for Apple email domains (@icloud.com, @mac.com, @me.com)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-semibold">Enhanced Features:</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Exponential backoff retry (up to 5 attempts)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Apple Mail optimized HTML structure
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Special unsubscribe headers
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Extended delay between retries (2-30 seconds)
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold">Alert Thresholds:</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  Warning: &lt;85% success rate
                </li>
                <li className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  Critical: &lt;70% success rate
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Alerts</CardTitle>
          <CardDescription>Latest email delivery alerts and notifications</CardDescription>
        </CardHeader>
        <CardContent>
          {recentAlerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No recent alerts</p>
              <p className="text-sm">Email delivery is performing well</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alert</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Success Rate</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentAlerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getAlertIcon(alert.details.alert_level)}
                        {getAlertBadge(alert.details.alert_level)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getDomainIcon(alert.details.domain_type)}
                        <span className="capitalize">{alert.details.domain_type}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`font-mono ${
                        (alert.details.success_rate || 0) < 70 ? 'text-red-600' : 
                        (alert.details.success_rate || 0) < 85 ? 'text-yellow-600' : 
                        'text-green-600'
                      }`}>
                        {alert.details.success_rate?.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {alert.details.successful_emails}/{alert.details.total_emails}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(alert.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}