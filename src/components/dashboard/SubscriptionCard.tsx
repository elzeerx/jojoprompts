import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, ArrowUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PlanUpgradeOptions } from "./PlanUpgradeOptions";

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

interface SubscriptionCardProps {
  userSubscription: UserSubscription | null;
}

export function SubscriptionCard({ userSubscription }: SubscriptionCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Subscription Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        {userSubscription ? (
          <div className="space-y-6">
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
                  {userSubscription.subscription_plans.is_lifetime ? (
                    <p className="text-green-600 font-medium">Lifetime Access</p>
                  ) : userSubscription.end_date ? (
                    <p>Expires: {formatDate(userSubscription.end_date)}</p>
                  ) : null}
                </div>
            </div>
            
            {/* Upgrade Options */}
            <PlanUpgradeOptions userSubscription={userSubscription} />
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
  );
}