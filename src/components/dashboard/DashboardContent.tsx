import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, CreditCard, Settings, Heart } from "lucide-react";
import { ProfileSettings } from "@/components/profile/ProfileSettings";
import { SubscriptionCard } from "./SubscriptionCard";
import { UserStatsCards } from "./UserStatsCards";
import { DangerZone } from "@/components/account/DangerZone";
import { EmailPreferences } from "@/components/account/EmailPreferences";

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

interface DashboardContentProps {
  userSubscription: UserSubscription | null;
  favoriteCount: number;
  promptCount: number;
}

export function DashboardContent({ 
  userSubscription, 
  favoriteCount, 
  promptCount 
}: DashboardContentProps) {
  const hasActiveSubscription = !!userSubscription;
  const subscriptionPlan = userSubscription?.subscription_plans?.name;

  return (
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
        <SubscriptionCard userSubscription={userSubscription} />
      </TabsContent>

      <TabsContent value="activity">
        <UserStatsCards 
          favoriteCount={favoriteCount} 
          promptCount={promptCount} 
        />
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

          <EmailPreferences />

          <DangerZone 
            hasActiveSubscription={hasActiveSubscription}
            subscriptionPlan={subscriptionPlan}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}