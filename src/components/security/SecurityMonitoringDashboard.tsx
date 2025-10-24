
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
import { SecurityMetricsCards } from './components/SecurityMetricsCards';
import { PolicyConflictsSection } from './components/PolicyConflictsSection';
import { RecommendationsSection } from './components/RecommendationsSection';
import { SecurityLoadingState } from './components/SecurityLoadingState';
import { createLogger } from '@/utils/logging';

const logger = createLogger('SecurityMonitoringDashboard');

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
      
      // Ensure we have a proper SecurityMetrics object
      const safeMetrics: SecurityMetrics = {
        totalEvents: currentMetrics.totalEvents || 0,
        authFailures: currentMetrics.authFailures || 0,
        suspiciousActivity: currentMetrics.suspiciousActivity || 0,
        rateLimitHits: currentMetrics.rateLimitHits || 0,
        paymentErrors: currentMetrics.paymentErrors || 0,
        accessDenied: currentMetrics.accessDenied || 0
      };
      setMetrics(safeMetrics);
      
      // Load recent security events from database
      const { data: securityLogs, error } = await supabase
        .from('security_logs')
        .select('action, created_at, details')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

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
      logger.error('Error loading security metrics', { error: error instanceof Error ? error.message : error });
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
      logger.error('Security audit failed', { error: error instanceof Error ? error.message : error });
    } finally {
      setAuditLoading(false);
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

      <SecurityMetricsCards metrics={metrics} />

      <PolicyConflictsSection conflicts={policyConflicts} />

      <RecommendationsSection recommendations={recommendations} />

      {loading && <SecurityLoadingState />}
    </div>
  );
}
