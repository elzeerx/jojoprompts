
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

  const fetchUsersCountFallback = async () => {
    try {
      console.log('Attempting fallback user count from profiles table...');
      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.error('Fallback profiles count error:', error);
        return 0;
      }
      
      console.log('Fallback profiles count:', count);
      return count || 0;
    } catch (err) {
      console.error('Failed to get fallback user count:', err);
      return 0;
    }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch prompts count
      const { data: prompts, error: promptsError } = await supabase
        .from("prompts")
        .select("id", { count: 'exact' });
      
      if (promptsError) throw promptsError;
      
      // Fetch users count from the edge function with timeout and proper error handling
      let usersCount = 0;
      
      if (session?.access_token) {
        try {
          console.log('Fetching users from edge function...');
          
          // Add timeout to the edge function call
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
          
          const { data: usersResponse, error: usersError } = await supabase.functions.invoke(
            "get-all-users",
            {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
              method: "GET",
              // Note: AbortController is not directly supported by supabase.functions.invoke
              // but we'll handle timeout with Promise.race if needed
            }
          );
          
          clearTimeout(timeoutId);
          
          if (usersError) {
            console.error("Error fetching users from edge function:", usersError);
            console.log('Falling back to profiles table count...');
            usersCount = await fetchUsersCountFallback();
          } else {
            console.log("Users response from edge function:", usersResponse);
            // Fix: Correctly extract total from the response structure
            usersCount = usersResponse?.total || 0;
            
            if (usersCount === 0 && usersResponse?.users?.length > 0) {
              // Fallback: if total is not provided but users array exists
              usersCount = usersResponse.users.length;
            }
          }
        } catch (err) {
          console.error("Failed to call get-all-users edge function:", err);
          console.log('Falling back to profiles table count...');
          usersCount = await fetchUsersCountFallback();
        }
      } else {
        console.log('No session access token available, using fallback...');
        usersCount = await fetchUsersCountFallback();
      }
      
      console.log('Final users count:', usersCount);
      
      setStats({
        prompts: prompts?.length ?? 0,
        users: usersCount,
        signups: usersCount, // Same as users count
        aiRuns: 0 // placeholder for future AI run tracking
      });
      
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch dashboard statistics";
      setError(errorMessage);
      
      // Try to get at least prompts count on error
      try {
        const { data: prompts } = await supabase
          .from("prompts")
          .select("id", { count: 'exact' });
        
        const fallbackUsersCount = await fetchUsersCountFallback();
        
        setStats({
          prompts: prompts?.length ?? 0,
          users: fallbackUsersCount,
          signups: fallbackUsersCount,
          aiRuns: 0
        });
      } catch (fallbackError) {
        console.error("Fallback stats fetch also failed:", fallbackError);
        toast({
          title: "Error loading dashboard data",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
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
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">
            <strong>Warning:</strong> {error}. Showing available data with fallback sources.
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
                  <span className={error && card.title === "Total Users" ? "text-orange-600" : ""}>
                    {card.value}
                  </span>
                )}
              </div>
              {error && card.title === "Total Users" && (
                <p className="text-xs text-orange-600 mt-1">Using fallback data</p>
              )}
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
