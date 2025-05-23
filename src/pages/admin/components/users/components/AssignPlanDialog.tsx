
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Crown, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface AssignPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onAssign: (planId: string) => void;
}

export function AssignPlanDialog({
  open,
  onOpenChange,
  userId,
  onAssign,
}: AssignPlanDialogProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [currentPlan, setCurrentPlan] = useState<any>(null);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, userId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch available plans
      const { data: plansData, error: plansError } = await supabase
        .from("subscription_plans")
        .select("id, name, price_usd, is_lifetime, duration_days")
        .order("price_usd", { ascending: true });

      if (plansError) throw plansError;

      // Fetch user's current plan
      const { data: userSub, error: userError } = await supabase
        .from("user_subscriptions")
        .select("*, plan_id(*)")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (userError && userError.code !== "PGRST116") {
        console.error("Error checking subscription:", userError);
      }

      setPlans(plansData || []);
      setCurrentPlan(userSub?.plan_id || null);
      
      // If user has a plan, preselect it
      if (userSub?.plan_id?.id) {
        setSelectedPlanId(userSub.plan_id.id);
      } else if (plansData && plansData.length > 0) {
        // Otherwise select the first plan by default
        setSelectedPlanId(plansData[0].id);
      }

    } catch (error) {
      console.error("Error loading plans:", error);
      toast({
        title: "Error",
        description: "Failed to load subscription plans",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedPlanId) return;
    
    try {
      setSubmitting(true);
      
      // Call the onAssign function to handle the action
      onAssign(selectedPlanId);
      
    } catch (error) {
      console.error("Error assigning plan:", error);
      toast({
        title: "Error",
        description: "Failed to assign the plan",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-xl font-semibold">Assign Subscription Plan</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Assign or change the subscription plan for this user. This will grant them access to the features included in their plan.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {currentPlan && (
              <div className="bg-muted/50 p-4 rounded-lg border border-muted">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="h-4 w-4 text-warm-gold" />
                  <p className="text-sm font-medium">Current Plan</p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-base">{currentPlan.name}</p>
                  <p className="text-sm text-muted-foreground">
                    ${currentPlan.price_usd} • {currentPlan.is_lifetime ? "Lifetime Access" : `${currentPlan.duration_days} days`}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Label htmlFor="plan" className="text-sm font-medium">Select New Plan</Label>
              <Select
                value={selectedPlanId}
                onValueChange={setSelectedPlanId}
              >
                <SelectTrigger id="plan" className="h-12">
                  <SelectValue placeholder="Choose a subscription plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id} className="py-3">
                      <div className="flex items-center justify-between w-full">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{plan.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ${plan.price_usd} • {plan.is_lifetime ? "Lifetime" : `${plan.duration_days} days`}
                          </span>
                        </div>
                        {plan.is_lifetime && (
                          <Clock className="h-4 w-4 text-warm-gold ml-2" />
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter className="space-x-2 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="min-w-[80px]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || submitting || !selectedPlanId}
            className="min-w-[120px] bg-warm-gold hover:bg-warm-gold/90"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              "Assign Plan"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
