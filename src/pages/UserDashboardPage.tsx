import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Heart, BarChart3, User, CreditCard, Settings, Plus } from "lucide-react";
import { useCollections } from "@/hooks/useCollections";
import { CollectionCard } from "@/components/collections/CollectionCard";
import { CreateCollectionDialog } from "@/components/collections/CreateCollectionDialog";

export default function UserDashboardPage() {
  const { loading: authLoading, session } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [stats, setStats] = useState({ favorites: 0, collections: 0, views: 0 });
  const { collections, loading: collectionsLoading } = useCollections();

  useEffect(() => {
    if (!authLoading && !session) {
      navigate("/login");
    }
  }, [authLoading, session, navigate]);

  useEffect(() => {
    if (session) {
      fetchUserData();
      fetchStats();
      fetchRecentActivity();
    }
  }, [session]);

  const fetchUserData = async () => {
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session?.user.id)
        .single();
      setProfile(profileData);

      // Fetch subscription
      const { data: subscriptionData } = await supabase
        .from('user_subscriptions')
        .select('*, subscription_plans(*)')
        .eq('user_id', session?.user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      setSubscription(subscriptionData);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchStats = async () => {
    if (!session) return;

    try {
      // Get favorites count
      const { count: favoritesCount } = await supabase
        .from('favorites')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id);

      // Get collections count
      const { count: collectionsCount } = await supabase
        .from('collections')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id);

      // Get views count
      const { count: viewsCount } = await supabase
        .from('prompt_usage_history')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('action_type', 'view');

      setStats({
        favorites: favoritesCount || 0,
        collections: collectionsCount || 0,
        views: viewsCount || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchRecentActivity = async () => {
    if (!session) return;

    try {
      const { data } = await supabase
        .from('prompt_usage_history')
        .select(`
          *,
          prompts(title, prompt_type)
        `)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      setRecentActivity(data || []);
    } catch (error) {
      console.error('Error fetching recent activity:', error);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {profile?.first_name || 'User'}!
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="border border-warm-gold/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Favorites</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.favorites}</div>
            <p className="text-xs text-muted-foreground">Prompts you've liked</p>
          </CardContent>
        </Card>

        <Card className="border border-warm-gold/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collections</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.collections}</div>
            <p className="text-xs text-muted-foreground">Organized collections</p>
          </CardContent>
        </Card>

        <Card className="border border-warm-gold/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Views</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.views}</div>
            <p className="text-xs text-muted-foreground">Prompts you've viewed</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Collections */}
            <Card className="border border-warm-gold/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Collections</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => navigate('/collections')}>
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {collections.length === 0 ? (
                  <div className="text-center py-6">
                    <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">No collections yet</p>
                    <CreateCollectionDialog 
                      trigger={
                        <Button size="sm" className="bg-warm-gold hover:bg-warm-gold/90 text-white">
                          <Plus className="h-4 w-4 mr-2" />
                          Create Collection
                        </Button>
                      }
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {collections.slice(0, 3).map((collection) => (
                      <div key={collection.id} className="flex items-center justify-between p-3 border border-warm-gold/20 rounded-lg">
                        <div>
                          <h4 className="font-medium">{collection.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {collection.prompt_count || 0} prompts
                          </p>
                        </div>
                        <Badge variant={collection.is_public ? "default" : "secondary"}>
                          {collection.is_public ? "Public" : "Private"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="border border-warm-gold/20">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {recentActivity.length === 0 ? (
                  <div className="text-center py-6">
                    <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No recent activity</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentActivity.slice(0, 5).map((activity) => (
                      <div key={activity.id} className="flex items-center justify-between p-3 border border-warm-gold/20 rounded-lg">
                        <div>
                          <h4 className="font-medium text-sm">
                            {activity.prompts?.title || 'Unknown Prompt'}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {activity.action_type} • {new Date(activity.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {activity.action_type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="collections" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Your Collections</h2>
            <CreateCollectionDialog />
          </div>
          
          {collectionsLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading collections...</p>
            </div>
          ) : collections.length === 0 ? (
            <Card className="border border-warm-gold/20">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Collections Yet</h3>
                <p className="text-muted-foreground text-center max-w-md mb-6">
                  Start organizing your prompts by creating your first collection.
                </p>
                <CreateCollectionDialog 
                  trigger={
                    <Button className="bg-warm-gold hover:bg-warm-gold/90 text-white">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Collection
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {collections.map((collection) => (
                <CollectionCard
                  key={collection.id}
                  collection={collection}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <Card className="border border-warm-gold/20">
            <CardHeader>
              <CardTitle>Activity History</CardTitle>
              <CardDescription>Your recent interactions with prompts</CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Activity Yet</h3>
                  <p className="text-muted-foreground">Start browsing prompts to see your activity here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-4 border border-warm-gold/20 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium">
                          {activity.prompts?.title || 'Unknown Prompt'}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {new Date(activity.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">
                          {activity.action_type}
                        </Badge>
                        <Badge variant="secondary">
                          {activity.prompts?.prompt_type || 'unknown'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="space-y-6">
          <Card className="border border-warm-gold/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">First Name</label>
                  <p className="text-sm text-muted-foreground">{profile?.first_name || 'Not set'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Last Name</label>
                  <p className="text-sm text-muted-foreground">{profile?.last_name || 'Not set'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <p className="text-sm text-muted-foreground">{session.user.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Role</label>
                  <Badge variant="outline">{profile?.role || 'user'}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {subscription && (
            <Card className="border border-warm-gold/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Subscription
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{subscription.subscription_plans?.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Status: <Badge variant="outline">{subscription.status}</Badge>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${subscription.subscription_plans?.price_usd}/month</p>
                    {subscription.end_date && (
                      <p className="text-sm text-muted-foreground">
                        Expires: {new Date(subscription.end_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
