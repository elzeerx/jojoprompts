import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface SubscriptionPlan {
  id: string;
  name: string;
  price_usd: number;
  is_lifetime: boolean;
  features: any;
}

interface UpgradeCost {
  current_plan_price: number;
  new_plan_price: number;
  remaining_days: number;
  remaining_value: number;
  upgrade_cost: number;
  savings: number;
}

interface UserSubscription {
  id: string;
  plan_id: string;
  end_date: string | null;
  subscription_plans: {
    name: string;
    price_usd: number;
    is_lifetime: boolean;
  };
}

interface PlanUpgradeOptionsProps {
  userSubscription: UserSubscription;
}

export function PlanUpgradeOptions({ userSubscription }: PlanUpgradeOptionsProps) {
  const { user } = useAuth();
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [upgradeCosts, setUpgradeCosts] = useState<Record<string, UpgradeCost>>({});
  const [loading, setLoading] = useState(true);
  const [processingUpgrade, setProcessingUpgrade] = useState<string | null>(null);

  useEffect(() => {
    fetchUpgradeOptions();
  }, [userSubscription.plan_id]);

  const fetchUpgradeOptions = async () => {
    try {
      // Fetch all plans
      const { data: plans, error: plansError } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('price_usd', { ascending: true });

      if (plansError) throw plansError;

      // Filter plans that are higher tier than current plan
      const currentPlanPrice = userSubscription.subscription_plans.price_usd;
      const higherTierPlans = plans?.filter(plan => 
        plan.price_usd > currentPlanPrice && plan.id !== userSubscription.plan_id
      ) || [];

      setAvailablePlans(higherTierPlans);

      // Calculate upgrade costs for each plan
      const costs: Record<string, UpgradeCost> = {};
      for (const plan of higherTierPlans) {
        const { data: costData } = await supabase
          .rpc('calculate_upgrade_cost', {
            current_plan_id: userSubscription.plan_id,
            new_plan_id: plan.id,
            current_subscription_end: userSubscription.end_date
          });

        if (costData && typeof costData === 'object' && !(costData as any).error) {
          costs[plan.id] = costData as unknown as UpgradeCost;
        }
      }
      setUpgradeCosts(costs);
    } catch (error) {
      console.error('Error fetching upgrade options:', error);
      toast({
        title: "Error",
        description: "Failed to load upgrade options",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId: string) => {
    if (!user) return;
    
    setProcessingUpgrade(planId);
    try {
      const upgradeCost = upgradeCosts[planId];
      
      if (upgradeCost.upgrade_cost <= 0) {
        // Free upgrade - handle directly
        await handleFreeUpgrade(planId);
      } else {
        // Paid upgrade - redirect to payment
        await handlePaidUpgrade(planId, upgradeCost.upgrade_cost);
      }
    } catch (error) {
      console.error('Upgrade error:', error);
      toast({
        title: "Upgrade Failed",
        description: "Failed to process upgrade. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingUpgrade(null);
    }
  };

  const handleFreeUpgrade = async (planId: string) => {
    // For free upgrades (when remaining value covers the difference)
    const { error } = await supabase
      .from('user_subscriptions')
      .update({ 
        plan_id: planId,
        updated_at: new Date().toISOString()
      })
      .eq('id', userSubscription.id);

    if (error) throw error;

    toast({
      title: "Upgrade Successful",
      description: "Your plan has been upgraded successfully!",
    });
    
    // Refresh the page to show updated subscription
    window.location.reload();
  };

  const handlePaidUpgrade = async (planId: string, amount: number) => {
    const { data, error } = await supabase.functions.invoke('process-paypal-payment', {
      body: {
        action: 'create',
        planId: planId,
        userId: user?.id,
        amount: amount,
        isUpgrade: true,
        upgradingFromPlanId: userSubscription.plan_id,
        currentSubscriptionId: userSubscription.id
      }
    });

    if (error) throw error;

    if (data.success && data.approvalUrl) {
      // Redirect to PayPal for payment
      window.open(data.approvalUrl, '_blank');
    } else {
      throw new Error('Failed to create upgrade payment session');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (availablePlans.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUp className="h-5 w-5" />
            Plan Upgrades
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            You're already on our highest tier plan! 🎉
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowUp className="h-5 w-5" />
          Available Upgrades
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {availablePlans.map((plan) => {
          const cost = upgradeCosts[plan.id];
          const isProcessing = processingUpgrade === plan.id;
          
          return (
            <div key={plan.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">{plan.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    ${plan.price_usd} {plan.is_lifetime ? "(Lifetime)" : "/year"}
                  </p>
                </div>
                <Badge variant="outline">Upgrade</Badge>
              </div>
              
              {cost && (
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Plan Price:</span>
                    <span>${cost.new_plan_price}</span>
                  </div>
                  {cost.savings > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Credit from current plan:</span>
                      <span>-${cost.savings.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold border-t pt-1">
                    <span>Upgrade Cost:</span>
                    <span>${cost.upgrade_cost.toFixed(2)}</span>
                  </div>
                </div>
              )}
              
              <Button 
                onClick={() => handleUpgrade(plan.id)}
                disabled={isProcessing || !cost}
                className="w-full"
                variant="outline"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  `Upgrade for $${cost?.upgrade_cost.toFixed(2) || '0.00'}`
                )}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}