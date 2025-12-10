import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserSubscription } from '@/hooks/useUserSubscription';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Crown, ArrowRight } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { isPrivilegedUser } from '@/utils/auth';

interface SubscriptionGuardProps {
  children: React.ReactNode;
  fallbackRoute?: string;
  showUpgradePrompt?: boolean;
}

export function SubscriptionGuard({ 
  children, 
  fallbackRoute = '/pricing',
  showUpgradePrompt = true 
}: SubscriptionGuardProps) {
  const navigate = useNavigate();
  const { user, userRole, loading: authLoading } = useAuth();
  const { userSubscription, isLoading: subscriptionLoading } = useUserSubscription(user?.id);

  // Show loading state while checking auth and subscription
  if (authLoading || subscriptionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Allow access for admin, prompter, and jadmin roles regardless of subscription
  if (isPrivilegedUser(userRole)) {
    return <>{children}</>;
  }

  // Check if user has active subscription
  if (userSubscription) {
    return <>{children}</>;
  }

  // User needs subscription - show upgrade prompt or redirect
  if (showUpgradePrompt) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
            <CardHeader className="text-center pb-6">
              <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center">
                <Crown className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                Premium Access Required
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <p className="text-muted-foreground text-lg">
                You need an active subscription to access the dashboard and premium features.
              </p>
              
              <div className="bg-white/50 rounded-lg p-4 border border-amber-200">
                <h3 className="font-semibold text-amber-800 mb-2">What you'll get:</h3>
                <ul className="text-sm text-amber-700 space-y-1">
                  <li>• Access to premium AI prompts</li>
                  <li>• Personal dashboard with favorites</li>
                  <li>• Advanced prompt management tools</li>
                  <li>• Priority customer support</li>
                </ul>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button 
                  onClick={() => navigate('/pricing')}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                >
                  View Pricing Plans
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/')}
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  Back to Home
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Already have a subscription? Try refreshing the page or contact support.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Redirect to fallback route
  navigate(fallbackRoute, { replace: true });
  return null;
}