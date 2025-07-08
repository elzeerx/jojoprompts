
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PolicyConflict {
  table: string;
  operation: string;
  policies: string[];
  severity: 'critical' | 'high' | 'medium';
}

interface PolicyConflictsSectionProps {
  conflicts: PolicyConflict[];
}

export function PolicyConflictsSection({ conflicts }: PolicyConflictsSectionProps) {
  if (conflicts.length === 0) {
    return null;
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'secondary';
      case 'medium': return 'outline';
      default: return 'outline';
    }
  };

  return (
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
          {conflicts.map((conflict, index) => (
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
  );
}
