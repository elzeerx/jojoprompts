
import React, { useState, useEffect } from "react";
import { PlanCard } from "@/components/subscription/PlanCard";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function PricingSection() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch available plans
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const { data, error } = await supabase
          .from("subscription_plans")
          .select("*")
          .order("price_usd", { ascending: true });

        if (error) {
          throw error;
        }

        if (data && data.length > 0) {
          setPlans(data);
          // Select the first plan by default
          setSelectedPlanId(data[0].id);
        }
      } catch (error) {
        console.error("Error fetching plans:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);

  // Handle selecting a plan
  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
    
    // Navigate directly to checkout with the selected plan
    navigate(`/checkout?plan_id=${planId}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div key={plan.id} className="flex flex-col h-full">
            <PlanCard
              plan={plan}
              isSelected={selectedPlanId === plan.id}
              onSelect={() => handleSelectPlan(plan.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
