
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield } from 'lucide-react';

interface RecommendationsSectionProps {
  recommendations: string[];
}

export function RecommendationsSection({ recommendations }: RecommendationsSectionProps) {
  if (recommendations.length === 0) {
    return null;
  }

  return (
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
  );
}
