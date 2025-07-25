
import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";
import { CheckoutSignupForm } from "@/components/checkout/CheckoutSignupForm";
import { useAuth } from "@/contexts/AuthContext";
import { logDebug } from "@/utils/secureLogging";
import { useCheckoutState } from "./CheckoutPage/hooks/useCheckoutState";
import { usePlanFetching } from "./CheckoutPage/hooks/usePlanFetching";
import { useAuthenticationFlow } from "./CheckoutPage/hooks/useAuthenticationFlow";
import { usePaymentHandling } from "./CheckoutPage/hooks/usePaymentHandling";
import { CheckoutProgress } from "./CheckoutPage/components/CheckoutProgress";
import { PlanSummaryCard } from "./CheckoutPage/components/PlanSummaryCard";
import { PaymentMethodsCard } from "./CheckoutPage/components/PaymentMethodsCard";
import { PaymentErrorBoundary } from "@/components/subscription/PaymentErrorBoundary";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get("plan_id");
  const authCallback = searchParams.get("auth_callback");
  const fromSignup = searchParams.get("from_signup") === "true";
  const { user, loading: authLoading } = useAuth();

  const {
    selectedPlan,
    setSelectedPlan,
    loading,
    setLoading,
    processing,
    setProcessing,
    error,
    setError,
    showAuthForm,
    setShowAuthForm,
    appliedDiscount,
    setAppliedDiscount
  } = useCheckoutState();

  // Log the current state for debugging (with sanitized data)
  logDebug("CheckoutPage state updated", "checkout", { 
    hasUser: !!user, 
    authLoading, 
    loading, 
    showAuthForm, 
    planId,
    authCallback,
    fromSignup,
    selectedPlanName: selectedPlan?.name,
    hasDiscount: !!appliedDiscount
  }, user?.id);

  usePlanFetching(planId, user, setSelectedPlan, setError, setLoading);

  const { handleAuthSuccess } = useAuthenticationFlow(
    user,
    authLoading,
    loading,
    selectedPlan,
    authCallback,
    setShowAuthForm
  );

  const { handlePaymentSuccess, handlePaymentError } = usePaymentHandling(
    user,
    selectedPlan,
    processing,
    setProcessing
  );

  const handleDiscountApplied = (discount: {
    id: string;
    code: string;
    discount_type: string;
    discount_value: number;
  }) => {
    setAppliedDiscount(discount);
  };

  const handleDiscountRemoved = () => {
    setAppliedDiscount(null);
  };

  // Override auth form visibility for users coming from signup
  React.useEffect(() => {
    if (!authLoading && !loading && selectedPlan) {
      if (fromSignup && user) {
        // User came from signup confirmation and is authenticated
        setShowAuthForm(false);
      } else if (!user) {
        setShowAuthForm(true);
      } else {
        setShowAuthForm(false);
      }
    }
  }, [user, authLoading, loading, selectedPlan, fromSignup, setShowAuthForm]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-soft-bg">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading checkout...</p>
        </div>
      </div>
    );
  }

  if (error || !selectedPlan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-soft-bg">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-4">
            {error || "Plan not found"}
          </h1>
          <Button onClick={() => navigate("/pricing")}>
            Back to Pricing
          </Button>
        </div>
      </div>
    );
  }

  const originalPrice = selectedPlan.price_usd;
  const features = Array.isArray(selectedPlan.features) ? selectedPlan.features : [];
  const planName = selectedPlan.name || "Access Plan";
  const isLifetime = selectedPlan.is_lifetime;

  return (
    <div className="min-h-screen bg-soft-bg py-16">
      <div className="container mx-auto max-w-4xl px-4">
        {/* Progress indicator */}
        <CheckoutProgress showAuthForm={showAuthForm} />

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">
            {showAuthForm ? "Create Your Account" : "Complete Your Purchase"}
          </h1>
          <p className="text-muted-foreground">
            {showAuthForm 
              ? `Create an account to purchase ${isLifetime ? "lifetime" : "1-year"} access to the ${selectedPlan.name} plan`
              : fromSignup
              ? `Welcome! Complete your purchase for ${isLifetime ? "lifetime" : "1-year"} access to the ${selectedPlan.name} plan`
              : `You're about to purchase ${isLifetime ? "lifetime" : "1-year"} access to the ${selectedPlan.name} plan`
            }
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Plan Summary with Discount */}
          <PlanSummaryCard
            selectedPlan={selectedPlan}
            price={originalPrice}
            features={features}
            isLifetime={isLifetime}
            appliedDiscount={appliedDiscount}
            onDiscountApplied={handleDiscountApplied}
            onDiscountRemoved={handleDiscountRemoved}
            processing={processing}
          />

          {/* Authentication Form or Payment Methods */}
          {showAuthForm ? (
            <CheckoutSignupForm
              onSuccess={handleAuthSuccess}
              planName={planName}
              planPrice={originalPrice}
            />
          ) : (
            <PaymentErrorBoundary>
              <PaymentMethodsCard
                processing={processing}
                price={originalPrice}
                planName={planName}
                planId={selectedPlan.id}
                userId={user?.id || ''}
                handlePaymentSuccess={handlePaymentSuccess}
                handlePaymentError={handlePaymentError}
                appliedDiscount={appliedDiscount}
              />
            </PaymentErrorBoundary>
          )}
        </div>

        <div className="text-center mt-8">
          <Button
            variant="outline"
            onClick={() => navigate("/pricing")}
            className="mr-4"
            disabled={processing}
          >
            Back to Pricing
          </Button>
        </div>
      </div>
    </div>
  );
}
