import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Container } from "@/components/ui/container";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { useUserSubscription } from "@/hooks/useUserSubscription";
import { useUserStats } from "@/hooks/useUserStats";

export default function UserDashboardPage() {
  const { user } = useAuth();
  
  const { userSubscription, isLoading: subscriptionLoading } = useUserSubscription(user?.id);
  const { favoriteCount, promptCount, isLoading: statsLoading } = useUserStats(user?.id);

  if (!user) {
    return (
      <Container className="py-8">
        <div className="text-center">
          <p>Please log in to access your dashboard.</p>
        </div>
      </Container>
    );
  }

  const isLoading = subscriptionLoading || statsLoading;

  return (
    <div className="min-h-screen bg-soft-bg/30">
      <Container className="py-8">
        <div className="mb-8">
          <h1 className="section-title">My Dashboard</h1>
          <p className="text-muted-foreground">Manage your account and view your activity</p>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <p>Loading dashboard...</p>
          </div>
        ) : (
          <DashboardContent
            userSubscription={userSubscription}
            favoriteCount={favoriteCount}
            promptCount={promptCount}
          />
        )}
      </Container>
    </div>
  );
}