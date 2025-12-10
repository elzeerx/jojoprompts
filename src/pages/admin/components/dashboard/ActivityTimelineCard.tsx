import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Activity, FileText, UserPlus, CreditCard, Heart } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

export interface ActivityItem {
  id: string;
  type: 'prompt_created' | 'user_signup' | 'payment_completed' | 'favorite_added';
  title: string;
  description: string;
  timestamp: string;
  user?: {
    name: string;
    avatar?: string;
  };
}

interface ActivityTimelineCardProps {
  activities: ActivityItem[];
  loading: boolean;
}

const getActivityIcon = (type: ActivityItem['type']) => {
  switch (type) {
    case 'prompt_created':
      return <FileText className="h-4 w-4 text-emerald-500" />;
    case 'user_signup':
      return <UserPlus className="h-4 w-4 text-blue-500" />;
    case 'payment_completed':
      return <CreditCard className="h-4 w-4 text-warm-gold" />;
    case 'favorite_added':
      return <Heart className="h-4 w-4 text-rose-500" />;
    default:
      return <Activity className="h-4 w-4 text-gray-500" />;
  }
};

const getActivityColor = (type: ActivityItem['type']) => {
  switch (type) {
    case 'prompt_created':
      return 'bg-emerald-100';
    case 'user_signup':
      return 'bg-blue-100';
    case 'payment_completed':
      return 'bg-amber-100';
    case 'favorite_added':
      return 'bg-rose-100';
    default:
      return 'bg-gray-100';
  }
};

export function ActivityTimelineCard({ activities, loading }: ActivityTimelineCardProps) {
  if (loading) {
    return (
      <Card className="rounded-2xl border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Activity className="h-5 w-5 text-warm-gold" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Activity className="h-5 w-5 text-warm-gold" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent activity
          </p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-2 bottom-2 w-px bg-gray-200" />
            
            <div className="space-y-4">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 relative">
                  {/* Activity icon with background */}
                  <div className={`relative z-10 p-1.5 rounded-full ${getActivityColor(activity.type)}`}>
                    {getActivityIcon(activity.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {activity.user && (
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={activity.user.avatar} />
                          <AvatarFallback className="text-[10px]">
                            {activity.user.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <p className="text-sm font-medium truncate">{activity.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {activity.description}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
