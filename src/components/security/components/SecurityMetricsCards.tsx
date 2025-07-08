
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, AlertTriangle, Shield, Users, Lock } from 'lucide-react';

interface SecurityMetrics {
  totalEvents: number;
  authFailures: number;
  suspiciousActivity: number;
  rateLimitHits: number;
  paymentErrors: number;
  accessDenied: number;
}

interface SecurityMetricsCardsProps {
  metrics: SecurityMetrics;
}

export function SecurityMetricsCards({ metrics }: SecurityMetricsCardsProps) {
  return (
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
  );
}
