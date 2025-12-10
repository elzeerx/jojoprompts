import { useEffect, useState } from "react";
import { Activity, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/utils/logging";

const logger = createLogger("RECENT_ACTIVITY");

interface ActivityItem {
  id: string;
  description: string;
  timestamp: string;
  username?: string;
}

export function RecentActivityCard() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecentActivity = async () => {
    try {
      setLoading(true);
      
      // Fetch recent prompts
      const { data: promptsData, error: promptsError } = await supabase
        .from("prompts")
        .select("id, title, created_at, user_id")
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (promptsError) throw promptsError;

      // Fetch usernames
      const userIds = promptsData?.map(p => p.user_id) || [];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", userIds);

      const usernameMap = new Map(profilesData?.map(p => [p.id, p.username]) || []);

      const formattedActivity: ActivityItem[] = (promptsData || []).map(item => ({
        id: item.id,
        description: `New prompt: "${item.title.substring(0, 40)}${item.title.length > 40 ? '...' : ''}"`,
        timestamp: item.created_at,
        username: usernameMap.get(item.user_id) || 'Unknown',
      }));

      setActivities(formattedActivity);
      setLoading(false);
    } catch (error) {
      logger.error('Error fetching recent activity', { error });
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentActivity();
  }, []);

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  };

  return (
    <Card className="rounded-2xl border border-gray-100 shadow-sm bg-white">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-dark-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-warm-gold" />
          Recent Activity
        </CardTitle>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={fetchRecentActivity}
          className="h-8 w-8 p-0"
        >
          <RefreshCw className={`h-4 w-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-warm-gold" />
          </div>
        ) : activities.length > 0 ? (
          <ul className="space-y-3">
            {activities.map((item) => (
              <li 
                key={item.id} 
                className="flex items-start gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0"
              >
                <div className="w-2 h-2 rounded-full bg-warm-gold mt-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-dark-base truncate">{item.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      @{item.username}
                    </span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(item.timestamp)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-center py-6 text-sm">
            No recent activity
          </p>
        )}
      </CardContent>
    </Card>
  );
}
