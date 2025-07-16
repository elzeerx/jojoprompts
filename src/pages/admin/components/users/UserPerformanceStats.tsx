import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Database, Search, Zap } from "lucide-react";

interface UserPerformanceStatsProps {
  performance?: {
    requestId: string;
    totalDuration: number;
    cacheHit: boolean;
    searchActive: boolean;
  };
  retryCount: number;
  total: number;
  loading: boolean;
}

export function UserPerformanceStats({ 
  performance, 
  retryCount, 
  total, 
  loading 
}: UserPerformanceStatsProps) {
  if (loading || !performance) {
    return null;
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getPerformanceColor = (duration: number) => {
    if (duration < 500) return "text-green-600";
    if (duration < 1000) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Performance Metrics
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-medium">Response Time</div>
              <div className={getPerformanceColor(performance.totalDuration)}>
                {formatDuration(performance.totalDuration)}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-medium">Cache Status</div>
              <Badge variant={performance.cacheHit ? "default" : "secondary"}>
                {performance.cacheHit ? "Hit" : "Miss"}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-medium">Search</div>
              <Badge variant={performance.searchActive ? "outline" : "secondary"}>
                {performance.searchActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-muted-foreground/20 flex items-center justify-center text-xs">
              {retryCount}
            </div>
            <div>
              <div className="font-medium">Total Users</div>
              <div className="text-muted-foreground">{total.toLocaleString()}</div>
            </div>
          </div>
        </div>
        
        {retryCount > 0 && (
          <div className="mt-3 pt-3 border-t">
            <Badge variant="outline" className="text-xs">
              {retryCount} retries performed
            </Badge>
          </div>
        )}
        
        <div className="mt-2 text-xs text-muted-foreground">
          Request ID: {performance.requestId}
        </div>
      </CardContent>
    </Card>
  );
}