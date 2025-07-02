
import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Container } from "@/components/ui/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { User, CreditCard, Settings, Heart, BookOpen, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { DangerZone } from "@/components/account/DangerZone";
import { ProfileSettings } from "@/components/profile/ProfileSettings";

interface UserSubscription {
  id: string;
  plan_id: string;
  status: string;
  start_date: string;
  end_date: string | null;
  subscription_plans: {
    name: string;
    price_usd: number;
    is_lifetime: boolean;
  };
}

export default function UserDashboardPage() {
  const { user, userRole } = useAuth();
  const [userSubscription, setUserSubscription] = useState<UserSubscription | null>(null);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [promptCount, setPromptCount] = useState(0);

  useEffect(() => {
    if (user) {
      fetchUserSubscription();
      fetchUserStats();
    }
  }, [user]);


  const fetchUserSubscription = async () => {
    try {
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select(`
          *,
          subscription_plans(name, price_usd, is_lifetime)
        `)
        .eq("user_id", user?.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        setUserSubscription(data[0] as UserSubscription);
      }
    } catch (error) {
      console.error("Error fetching subscription:", error);
    }
  };

  const fetchUserStats = async () => {
    try {
      // Fetch favorites count
      const { count: favCount } = await supabase
        .from("favorites")
        .select("*", { count: "exact" })
        .eq("user_id", user?.id);

      // Fetch prompts count (if user can manage prompts)
      const { count: promptsCount } = await supabase
        .from("prompts")
        .select("*", { count: "exact" })
        .eq("user_id", user?.id);

      setFavoriteCount(favCount || 0);
      setPromptCount(promptsCount || 0);
    } catch (error) {
      console.error("Error fetching user stats:", error);
    }
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (!user) {
    return (
      <Container className="py-8">
        <div className="text-center">
          <p>Please log in to access your dashboard.</p>
        </div>
      </Container>
    );
  }

  const hasActiveSubscription = !!userSubscription;
  const subscriptionPlan = userSubscription?.subscription_plans?.name;

  return (
    <div className="min-h-screen bg-soft-bg/30">
      <Container className="py-8">
        <div className="mb-8">
          <h1 className="section-title">My Dashboard</h1>
          <p className="text-muted-foreground">Manage your account and view your activity</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="subscription" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Subscription
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-2">
              <Heart className="h-4 w-4" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <ProfileSettings />
          </TabsContent>

          <TabsContent value="subscription">
            <Card>
              <CardHeader>
                <CardTitle>Subscription Status</CardTitle>
              </CardHeader>
              <CardContent>
                {userSubscription ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{userSubscription.subscription_plans.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          ${userSubscription.subscription_plans.price_usd} 
                          {userSubscription.subscription_plans.is_lifetime ? " (Lifetime)" : " /year"}
                        </p>
                      </div>
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        Active
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>Started: {formatDate(userSubscription.start_date)}</p>
                      {userSubscription.end_date && (
                        <p>Expires: {formatDate(userSubscription.end_date)}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">No active subscription</p>
                    <Button asChild>
                      <a href="/pricing">View Plans</a>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5" />
                    Favorites
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{favoriteCount}</div>
                  <p className="text-sm text-muted-foreground">Prompts saved to favorites</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    My Prompts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{promptCount}</div>
                  <p className="text-sm text-muted-foreground">Prompts you've created</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Account Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Manage your account preferences and settings.
                  </p>
                </CardContent>
              </Card>

              <DangerZone 
                hasActiveSubscription={hasActiveSubscription}
                subscriptionPlan={subscriptionPlan}
              />
            </div>
          </TabsContent>
        </Tabs>
      </Container>
    </div>
  );
}
