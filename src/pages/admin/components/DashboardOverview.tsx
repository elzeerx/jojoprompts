
import { useEffect, useState } from "react";
import { FileText, Users, Activity, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface Stats {
  prompts: number;
  users: number;
  signups: number;
  aiRuns: number;
}

interface ActivityItem {
  id: string;
  description: string;
  timestamp: string;
  user_email?: string;
}

export default function DashboardOverview() {
  const [stats, setStats] = useState<Stats>({
    prompts: 0,
    users: 0,
    signups: 0,
    aiRuns: 0,
  });
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, session } = useAuth();

  // Fetch initial data
  useEffect(() => {
    fetchStats();
    fetchRecentActivity();
    
    // Set up real-time listeners
    const promptsChannel = supabase
      .channel('schema-db-changes-prompts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'prompts' },
        () => {
          console.log('Prompts table changed, refreshing stats');
          fetchStats();
          fetchRecentActivity();
        }
      )
      .subscribe();
      
    const profilesChannel = supabase
      .channel('schema-db-changes-profiles')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          console.log('Profiles table changed, refreshing stats');
          fetchStats();
        }
      )
      .subscribe();
      
    // Cleanup function
    return () => {
      supabase.removeChannel(promptsChannel);
      supabase.removeChannel(profilesChannel);
    };
  }, [session]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching prompts count...');
      // Fetch prompts count using proper count query
      const { count: promptsCount, error: promptsError } = await supabase
        .from("prompts")
        .select("*", { count: 'exact', head: true });
      
      if (promptsError) {
        console.error('Prompts count error:', promptsError);
        throw promptsError;
      }
      
      console.log('Prompts count result:', promptsCount);

      console.log('Fetching users count...');
      // Fetch users count directly from profiles table
      const { count: usersCount, error: usersError } = await supabase
        .from('profiles')
        .select("*", { count: 'exact', head: true });
      
      if (usersError) {
        console.error('Users count error:', usersError);
        throw usersError;
      }
      
      console.log('Users count result:', usersCount);
      
      setStats({
        prompts: promptsCount || 0,
        users: usersCount || 0,
        signups: usersCount || 0, // Same as users count
        aiRuns: 0 // placeholder for future AI run tracking
      });
      
      console.log('Stats updated successfully:', {
        prompts: promptsCount || 0,
        users: usersCount || 0,
      });
      
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch dashboard statistics";
      setError(errorMessage);
      
      toast({
        title: "Error loading dashboard data",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      console.log('Fetching recent activity...');
      // Fetch 5 most recent prompts
      const { data: promptsData, error: promptsError } = await supabase
        .from("prompts")
        .select(`
          id,
          title,
          created_at,
          user_id
        `)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (promptsError) {
        console.error('Recent activity error:', promptsError);
        throw promptsError;
      }
      
      console.log('Recent prompts data:', promptsData);
      
      if (!promptsData || promptsData.length === 0) {
        setRecentActivity([]);
        return;
      }
      
      // Fetch user emails in a separate query
      const userIds = promptsData.map(prompt => prompt.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", userIds);
        
      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
      }
      
      // Create a map of user IDs to names
      const userNameMap = new Map();
      if (profilesData) {
        profilesData.forEach(profile => {
          const fullName = `${profile.first_name} ${profile.last_name}`.trim();
          userNameMap.set(profile.id, fullName || 'Unknown user');
        });
      }
      
      // Format the activity data
      const formattedActivity: ActivityItem[] = promptsData.map(item => ({
        id: item.id,
        description: `New prompt created: "${item.title}"`,
        timestamp: item.created_at,
        user_email: userNameMap.get(item.user_id) || 'Unknown user'
      }));
      
      setRecentActivity(formattedActivity);
      console.log('Recent activity updated:', formattedActivity);
    } catch (error) {
      console.error("Error fetching recent activity:", error);
    }
  };

  // Only show cards with real data
  const cards = [
    {
      title: "Total Prompts",
      value: stats.prompts,
      icon: FileText,
    },
    {
      title: "Total Users",
      value: stats.users,
      icon: Users,
    }
  ];

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">
            <strong>Warning:</strong> {error}. Please try refreshing the page.
          </p>
        </div>
      )}
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} className="border-warm-gold/20 bg-white/95 shadow-sm hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-warm-gold/10 via-transparent to-muted-teal/10">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-warm-gold" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-dark-base">
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-warm-gold" />
                ) : (
                  <span>{card.value}</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 border-warm-gold/20 bg-white/95 shadow-sm hover:shadow-md transition-all">
          <CardHeader className="bg-gradient-to-r from-warm-gold/10 via-transparent to-muted-teal/10">
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest user actions and system events</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-warm-gold" />
              </p>
            ) : recentActivity.length > 0 ? (
              <ul className="space-y-4">
                {recentActivity.map((item) => (
                  <li key={item.id} className="flex items-start gap-2 border-b border-warm-gold/10 pb-3 last:border-0">
                    <Activity className="h-5 w-5 text-warm-gold mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{item.description}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>{new Date(item.timestamp).toLocaleString()}</span>
                        {item.user_email && <span>by {item.user_email}</span>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-center py-4">No activity yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
