
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
      
      // Fetch prompts count
      const { data: prompts, error: promptsError } = await supabase
        .from("prompts")
        .select("id", { count: 'exact' });
      
      if (promptsError) throw promptsError;
      
      // Fetch users count from the edge function that accesses auth.users
      let usersCount = 0;
      
      if (session?.access_token) {
        try {
          const { data: allUsers, error: usersError } = await supabase.functions.invoke(
            "get-all-users",
            {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            }
          );
          
          if (usersError) {
            console.error("Error fetching users from edge function:", usersError);
          } else {
            usersCount = Array.isArray(allUsers) ? allUsers.length : 0;
          }
        } catch (err) {
          console.error("Failed to call get-all-users edge function:", err);
        }
      }
      
      setStats({
        prompts: prompts?.length ?? 0,
        users: usersCount,
        signups: usersCount, // Same as users count
        aiRuns: 0 // placeholder for future AI run tracking
      });
      
      setLoading(false);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      toast({
        title: "Error loading dashboard data",
        description: "Failed to fetch dashboard statistics.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const fetchRecentActivity = async () => {
    try {
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
      
      if (promptsError) throw promptsError;
      
      // Fetch user emails in a separate query
      const userIds = promptsData.map(prompt => prompt.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email:id")
        .in("id", userIds);
        
      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
      }
      
      // Create a map of user IDs to emails
      const userEmailMap = new Map();
      if (profilesData) {
        profilesData.forEach(profile => {
          userEmailMap.set(profile.id, profile.email);
        });
      }
      
      // Format the activity data
      const formattedActivity: ActivityItem[] = promptsData.map(item => ({
        id: item.id,
        description: `New prompt created: "${item.title}"`,
        timestamp: item.created_at,
        user_email: userEmailMap.get(item.user_id) || 'Unknown user'
      }));
      
      setRecentActivity(formattedActivity);
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
                {loading ? "Loading..." : card.value === 0 ? "No data yet" : card.value}
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
