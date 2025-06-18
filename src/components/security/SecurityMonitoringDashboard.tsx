
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Shield, AlertTriangle, Activity, Users, Lock } from 'lucide-react';
import { RLSPolicyAuditor } from '@/utils/security/rlsPolicyAuditor';
import { securityMonitor } from '@/utils/monitoring';

interface SecurityMetrics {
  totalEvents: number;
  authFailures: number;
  suspiciousActivity: number;
  rateLimitHits: number;
  paymentErrors: number;
  accessDenied: number;
}

interface PolicyConflict {
  table: string;
  operation: string;
  policies: string[];
  severity: 'critical' | 'high' | 'medium';
}

export function SecurityMonitoringDashboard() {
  const { user, isAdmin } = useAuth();
  const [metrics, setMetrics] = useState<SecurityMetrics>({
    totalEvents: 0,
    authFailures: 0,
    suspiciousActivity: 0,
    rateLimitHits: 0,
    paymentErrors: 0,
    accessDenied: 0
  });
  const [policyConflicts, setPolicyConflicts] = useState<PolicyConflict[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);

  // Only allow admin access
  if (!isAdmin) {
    return (
      <Alert>
        <Lock className="h-4 w-4" />
        <AlertDescription>
          Administrative privileges required to access security monitoring.
        </AlertDescription>
      </Alert>
    );
  }

  useEffect(() => {
    loadSecurityMetrics();
  }, []);

  const loadSecurityMetrics = async () => {
    try {
      setLoading(true);
      
      // Load security metrics from monitoring system
      const currentMetrics = securityMonitor.getSecurityMetrics();
      setMetrics(currentMetrics);
      
      // Load recent security events from database using raw SQL query
      const { data: securityLogs, error } = await supabase
        .rpc('get_security_logs', {
          days_back: 1,
          limit_count: 100
        })
        .then(result => ({ data: null, error: result.error }))
        .catch(() => ({ data: null, error: null }));

      if (!error && securityLogs) {
        // Process logs to update metrics
        const logMetrics = processSecurityLogs(securityLogs);
        setMetrics(prev => ({
          totalEvents: logMetrics.totalEvents || prev.totalEvents,
          authFailures: logMetrics.authFailures || prev.authFailures,
          suspiciousActivity: logMetrics.suspiciousActivity || prev.suspiciousActivity,
          rateLimitHits: logMetrics.rateLimitHits || prev.rateLimitHits,
          paymentErrors: logMetrics.paymentErrors || prev.paymentErrors,
          accessDenied: logMetrics.accessDenied || prev.accessDenied
        }));
      }
      
    } catch (error) {
      console.error('Error loading security metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const processSecurityLogs = (logs: any[]): Partial<SecurityMetrics> => {
    const processed: Partial<SecurityMetrics> = {
      totalEvents: logs.length
    };

    logs.forEach(log => {
      switch (log.action) {
        case 'admin_function_access_denied':
        case 'unauthorized_admin_access_attempt':
          processed.authFailures = (processed.authFailures || 0) + 1;
          break;
        case 'suspicious_admin_activity_detected':
        case 'suspicious_activity':
          processed.suspiciousActivity = (processed.suspiciousActivity || 0) + 1;
          break;
        case 'rate_limit_exceeded':
          processed.rateLimitHits = (processed.rateLimitHits || 0) + 1;
          break;
        case 'payment_error':
          processed.paymentErrors = (processed.paymentErrors || 0) + 1;
          break;
        case 'access_denied':
          processed.accessDenied = (processed.accessDenied || 0) + 1;
          break;
      }
    });

    return processed;
  };

  const runSecurityAudit = async () => {
    try {
      setAuditLoading(true);
      
      // Run RLS policy audit
      const auditResults = await RLSPolicyAuditor.auditPolicies();
      setPolicyConflicts(auditResults.conflicts);
      setRecommendations(auditResults.recommendations);
      
    } catch (error) {
      console.error('Security audit failed:', error);
    } finally {
      setAuditLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'secondary';
      case 'medium': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Security Monitoring</h2>
          <p className="text-muted-foreground">
            Monitor security events and system health
          </p>
        </div>
        <Button
          onClick={runSecurityAudit}
          disabled={auditLoading}
          className="flex items-center gap-2"
        >
          <Shield className="h-4 w-4" />
          {auditLoading ? 'Running Audit...' : 'Run Security Audit'}
        </Button>
      </div>

      {/* Security Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events (24h)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalEvents}</div>
            <p className="text-xs text-muted-foreground">
              Security events logged
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auth Failures</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{metrics.authFailures}</div>
            <p className="text-xs text-muted-foreground">
              Failed authentication attempts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspicious Activity</CardTitle>
            <Shield className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{metrics.suspiciousActivity}</div>
            <p className="text-xs text-muted-foreground">
              Potentially malicious events
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rate Limit Hits</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{metrics.rateLimitHits}</div>
            <p className="text-xs text-muted-foreground">
              Rate limiting triggered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payment Errors</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{metrics.paymentErrors}</div>
            <p className="text-xs text-muted-foreground">
              Payment processing issues
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Access Denied</CardTitle>
            <Lock className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{metrics.accessDenied}</div>
            <p className="text-xs text-muted-foreground">
              Unauthorized access attempts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Policy Conflicts */}
      {policyConflicts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-red-600">
              Policy Conflicts Detected
            </CardTitle>
            <CardDescription>
              The following RLS policy conflicts require immediate attention:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {policyConflicts.map((conflict, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{conflict.table} - {conflict.operation}</div>
                    <div className="text-sm text-muted-foreground">
                      Conflicting policies: {conflict.policies.join(', ')}
                    </div>
                  </div>
                  <Badge variant={getSeverityColor(conflict.severity) as any}>
                    {conflict.severity.toUpperCase()}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Security Recommendations</CardTitle>
            <CardDescription>
              Suggested improvements to enhance system security:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-start gap-2 p-2 bg-blue-50 rounded-lg">
                  <Shield className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-blue-800">{recommendation}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading security metrics...</p>
          </div>
        </div>
      )}
    </div>
  );
}
