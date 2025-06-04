import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Check, Crown, AlertCircle, ArrowRight } from "lucide-react";
import { PayPalButton } from "@/components/subscription/PayPalButton";
import { SecureTapPaymentButton } from "@/components/subscription/SecureTapPaymentButton";
import { TapPaymentButton } from "@/components/subscription/TapPaymentButton";
import { CheckoutSignupForm } from "@/components/checkout/CheckoutSignupForm";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { logInfo, logWarn, logError, logDebug } from "@/utils/secureLogging";
import { enhancedRateLimiter, EnhancedRateLimitConfigs } from "@/utils/enhancedRateLimiting";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get("plan_id");
  const authCallback = searchParams.get("auth_callback");
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const { user, loading: authLoading } = useAuth();

  // Log the current state for debugging (with sanitized data)
  logDebug("CheckoutPage state updated", "checkout", { 
    hasUser: !!user, 
    authLoading, 
    loading, 
    showAuthForm, 
    planId,
    authCallback,
    selectedPlanName: selectedPlan?.name 
  }, user?.id);

  useEffect(() => {
    const fetchPlan = async () => {
      if (!planId) {
        logError("No plan ID provided in checkout", "checkout");
        setError("No plan selected");
        toast({
          title: "Error",
          description: "No plan selected. Redirecting to pricing page.",
          variant: "destructive",
        });
        setTimeout(() => navigate("/pricing"), 2000);
        return;
      }

      try {
        logDebug("Fetching plan details", "checkout", { planId });
        setLoading(true);
        const { data, error } = await supabase
          .from("subscription_plans")
          .select("*")
          .eq("id", planId)
          .single();

        if (error) throw error;

        logInfo("Plan fetched successfully", "checkout", { planName: data.name }, user?.id);
        setSelectedPlan(data);
        setError(null);
      } catch (error) {
        logError("Error fetching plan details", "checkout", { planId, error: error.message }, user?.id);
        setError("Failed to load plan details");
        toast({
          title: "Error",
          description: "Failed to load plan details",
          variant: "destructive",
        });
        setTimeout(() => navigate("/pricing"), 2000);
      } finally {
        setLoading(false);
      }
    };

    fetchPlan();
  }, [planId, navigate, user?.id]);

  useEffect(() => {
    logDebug("Auth state effect triggered", "checkout", { 
      hasUser: !!user, 
      authLoading, 
      loading, 
      selectedPlanName: selectedPlan?.name, 
      authCallback 
    }, user?.id);
    
    if (!authLoading && !loading && selectedPlan) {
      if (!user) {
        logInfo("No user found, showing auth form", "checkout");
        setShowAuthForm(true);
      } else {
        logInfo("User authenticated, hiding auth form", "checkout", undefined, user.id);
        setShowAuthForm(false);
        
        // If this is a Google OAuth callback, clean up the URL
        if (authCallback === 'google') {
          logInfo("Handling Google OAuth callback", "checkout", undefined, user.id);
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('auth_callback');
          window.history.replaceState({}, document.title, newUrl.toString());
          
          toast({
            title: "Welcome!",
            description: "Successfully signed in with Google. Complete your purchase below.",
          });
        }
      }
    }
  }, [user, authLoading, loading, selectedPlan, authCallback]);

  const handleAuthSuccess = useCallback(() => {
    logInfo("Auth success callback triggered", "checkout", undefined, user?.id);
    setShowAuthForm(false);
    toast({
      title: "Success!",
      description: "Account ready. You can now complete your purchase.",
    });
  }, [user?.id]);

  const handlePaymentSuccess = useCallback(async (paymentData: any) => {
    // Check rate limiting for payment attempts
    const paymentRateCheck = enhancedRateLimiter.isAllowed(
      `payment_${user?.id || 'anonymous'}`,
      EnhancedRateLimitConfigs.PAYMENT_ATTEMPT
    );

    if (!paymentRateCheck.allowed) {
      toast({
        title: "Too Many Payment Attempts",
        description: `Please wait ${paymentRateCheck.retryAfter} seconds before trying again.`,
        variant: "destructive",
      });
      return;
    }

    if (processing) {
      logWarn("Payment already processing, ignoring duplicate call", "payment", undefined, user?.id);
      return;
    }
    
    if (!user?.id) {
      logError("User not authenticated during payment success", "payment");
      toast({
        title: "Authentication Error",
        description: "Please refresh the page and try again.",
        variant: "destructive",
      });
      return;
    }
    
    setProcessing(true);
    
    try {
      logInfo("Processing payment success", "payment", { 
        paymentMethod: paymentData.paymentMethod || (paymentData.source ? 'tap' : 'paypal'),
        planId: selectedPlan.id 
      }, user.id);
      
      // Standardize payment data structure
      const standardizedPaymentData = {
        paymentId: paymentData.paymentId || paymentData.payment_id || paymentData.id,
        paymentMethod: paymentData.paymentMethod || (paymentData.source ? 'tap' : 'paypal'),
        details: {
          id: paymentData.id || paymentData.paymentId,
          status: paymentData.status,
          amount: paymentData.amount
        }
      };

      const requestPayload = {
        planId: selectedPlan.id,
        userId: user.id,
        paymentData: standardizedPaymentData
      };

      logDebug("Sending request to create-subscription", "payment", { planId: selectedPlan.id }, user.id);

      // Create a timeout promise for manual timeout handling
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Request timed out after 30 seconds")), 30000);
      });

      // Race between the function call and timeout
      const functionPromise = supabase.functions.invoke("create-subscription", {
        body: requestPayload
      });

      const { data, error } = await Promise.race([functionPromise, timeoutPromise]) as any;

      logDebug("Supabase function response received", "payment", { success: !!data?.success }, user.id);

      if (error) {
        logError("Supabase function error", "payment", { error: error.message }, user.id);
        throw new Error(`Function error: ${error.message || JSON.stringify(error)}`);
      }

      if (!data || !data.success) {
        logError("Function returned unsuccessful response", "payment", { dataExists: !!data }, user.id);
        throw new Error(data?.error || "Function returned unsuccessful response");
      }

      logInfo("Plan access created successfully", "payment", undefined, user.id);

      toast({
        title: "Success!",
        description: "Your plan access has been activated",
      });

      navigate("/payment-success");

    } catch (error) {
      // Record failed payment attempt for rate limiting
      enhancedRateLimiter.recordFailedAttempt(
        `payment_${user?.id}`,
        { error: error.message, planId: selectedPlan?.id }
      );
      
      logError("Error creating plan access", "payment", { 
        error: error.message,
        errorType: error.name 
      }, user?.id);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      toast({
        title: "Payment Processing Error",
        description: `Failed to activate plan access: ${errorMessage}. Please contact support if this persists.`,
        variant: "destructive",
      });
      
    } finally {
      setProcessing(false);
    }
  }, [processing, selectedPlan, user, navigate]);

  const handlePaymentError = useCallback((error: any) => {
    logError("Payment error occurred", "payment", { error: error.message }, user?.id);
    setProcessing(false);
    toast({
      title: "Payment Failed",
      description: "There was an issue processing your payment. Please try again.",
      variant: "destructive",
    });
  }, [user?.id]);

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

  const price = selectedPlan.price_usd;
  const features = Array.isArray(selectedPlan.features) ? selectedPlan.features : [];
  const planName = selectedPlan.name || "Access Plan";
  const isLifetime = selectedPlan.is_lifetime;

  return (
    <div className="min-h-screen bg-soft-bg py-16">
      <div className="container mx-auto max-w-4xl px-4">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4 text-sm">
            <div className={`flex items-center ${showAuthForm ? 'text-warm-gold' : 'text-green-600'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs mr-2 ${showAuthForm ? 'bg-warm-gold' : 'bg-green-600'}`}>
                {showAuthForm ? '1' : <Check className="h-3 w-3" />}
              </div>
              <span>Create Account</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className={`flex items-center ${!showAuthForm ? 'text-warm-gold' : 'text-muted-foreground'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs mr-2 ${!showAuthForm ? 'bg-warm-gold' : 'bg-gray-300'}`}>
                2
              </div>
              <span>Complete Payment</span>
            </div>
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">
            {showAuthForm ? "Create Your Account" : "Complete Your Purchase"}
          </h1>
          <p className="text-muted-foreground">
            {showAuthForm 
              ? `Create an account to purchase ${isLifetime ? "lifetime" : "1-year"} access to the ${selectedPlan.name} plan`
              : `You're about to purchase ${isLifetime ? "lifetime" : "1-year"} access to the ${selectedPlan.name} plan`
            }
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Plan Summary */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-warm-gold" />
                {selectedPlan.name} Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-warm-gold">
                  ${price}
                  {isLifetime ? (
                    <span className="text-lg text-muted-foreground"> one-time</span>
                  ) : (
                    <span className="text-lg text-muted-foreground"> for 1 year</span>
                  )}
                </div>
                <p className="text-muted-foreground mt-2">
                  {selectedPlan.description}
                </p>
                {!isLifetime && (
                  <p className="text-sm text-amber-600 mt-2 font-medium">
                    One-time payment • Access expires after 1 year
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Included Features:</h4>
                <ul className="space-y-1">
                  {features.map((feature: string, index: number) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Authentication Form or Payment Methods */}
          {showAuthForm ? (
            <CheckoutSignupForm
              onSuccess={handleAuthSuccess}
              planName={planName}
              planPrice={price}
            />
          ) : (
            <Card className="relative">
              <CardHeader>
                <CardTitle>Choose Payment Method</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {processing && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                      <p className="font-medium">Processing payment...</p>
                      <p className="text-sm text-muted-foreground">Please don't close this page</p>
                    </div>
                  </div>
                )}
                
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <span>PayPal</span>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Recommended</span>
                    </h4>
                    <PayPalButton
                      amount={price}
                      planName={planName}
                      onSuccess={(paymentId, details) => {
                        handlePaymentSuccess({
                          paymentId,
                          paymentMethod: 'paypal',
                          details
                        });
                      }}
                      onError={handlePaymentError}
                      className="w-full"
                    />
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Or pay with card
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Credit Card (Tap Payments)</h4>
                    <SecureTapPaymentButton
                      amount={price}
                      planName={planName}
                      onSuccess={(paymentId) => {
                        handlePaymentSuccess({
                          paymentId,
                          paymentMethod: 'tap',
                          payment_id: paymentId
                        });
                      }}
                      onError={handlePaymentError}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
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
