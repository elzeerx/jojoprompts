
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
import { Loader2 } from "lucide-react";
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
        .select("id, name, price_usd, is_lifetime, duration_days");

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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Assign Subscription Plan</DialogTitle>
          <DialogDescription>
            Assign or change the subscription plan for this user.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {currentPlan && (
              <div className="bg-muted p-3 rounded-md">
                <p className="text-sm font-medium">Current Plan</p>
                <p className="text-muted-foreground">
                  {currentPlan.name} (${currentPlan.price_usd})
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="plan">Select Plan</Label>
              <Select
                value={selectedPlanId}
                onValueChange={setSelectedPlanId}
              >
                <SelectTrigger id="plan">
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} - ${plan.price_usd} ({plan.is_lifetime ? "Lifetime" : `${plan.duration_days} days`})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || submitting || !selectedPlanId}
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
