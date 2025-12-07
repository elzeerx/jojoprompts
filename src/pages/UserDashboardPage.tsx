import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Container } from "@/components/ui/container";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { useUserSubscription } from "@/hooks/useUserSubscription";
import { useUserStats } from "@/hooks/useUserStats";
import { SectionLoadingState, EmptyState } from "@/components/ui/loading-states";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function UserDashboardPage() {
  const { user } = useAuth();
  
  const { userSubscription, isLoading: subscriptionLoading } = useUserSubscription(user?.id);
  const { favoriteCount, promptCount, isLoading: statsLoading } = useUserStats(user?.id);

  if (!user) {
    return (
      <Container className="py-8">
        <EmptyState
          icon={<LogIn className="h-6 w-6 text-warm-gold" />}
          title="Login Required"
          description="Please log in to access your dashboard."
          action={
            <Button asChild className="mobile-button-primary">
              <Link to="/login">Log In</Link>
            </Button>
          }
        />
      </Container>
    );
  }

  const isLoading = subscriptionLoading || statsLoading;

  return (
    <div className="min-h-screen bg-soft-bg/30">
      <Container className="pt-20 lg:pt-24 pb-8">
        <div className="mb-8">
          <h1 className="section-title">My Dashboard</h1>
          <p className="text-muted-foreground">Manage your account and view your activity</p>
        </div>

        {isLoading ? (
          <SectionLoadingState message="Loading dashboard..." />
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