import React, { useState, useEffect } from "react";
import { PlanCard } from "@/components/subscription/PlanCard";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from "@/contexts/AuthContext";
import { createLogger } from '@/utils/logging';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { ExpressCheckoutModal } from "./ExpressCheckoutModal";

const logger = createLogger('PRICING_SECTION');

interface Plan {
  id: string;
  name: string;
  description?: string | null;
  price_usd: number;
  is_lifetime: boolean;
  features: string[] | any;
  excluded_features?: string[] | any;
  tier: string;
}

export function PricingSection() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showExpressCheckout, setShowExpressCheckout] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { t, isRTL } = useTranslation();

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
          // No default selection - let user choose
          setSelectedPlanId(null);
        }
      } catch (error: any) {
        logger.error('Error fetching plans', { error: error.message });
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);

  // Handle selecting a plan - now opens express checkout modal
  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
    const plan = plans.find(p => p.id === planId);
    if (plan) {
      setSelectedPlan(plan);
      setShowExpressCheckout(true);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8 sm:py-12">
        <div className="text-center space-y-3">
          <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-warm-gold mx-auto" />
          <p className={cn("text-sm sm:text-base text-muted-foreground", isRTL && "rtl-text")}>{t('pricingSection.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full max-w-7xl mx-auto mobile-container-padding">
        {/* Minimalist grid with 1px gap borders */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200 rounded-2xl overflow-hidden">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isSelected={selectedPlanId === plan.id}
              isPopular={plan.price_usd === 80}
              onSelect={() => handleSelectPlan(plan.id)}
            />
          ))}
        </div>
      </div>

      {/* Express Checkout Modal */}
      <ExpressCheckoutModal
        open={showExpressCheckout}
        onOpenChange={setShowExpressCheckout}
        plan={selectedPlan}
      />
    </>
  );
}
