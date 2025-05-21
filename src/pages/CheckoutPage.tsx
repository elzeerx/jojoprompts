
import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PlanCard } from "@/components/subscription/PlanCard";
import { PayPalButton } from "@/components/subscription/PayPalButton";
import { TapPaymentButton } from "@/components/subscription/TapPaymentButton";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Plan {
  id: string;
  name: string;
  description: string;
  price_usd: number;
  price_kwd: number;
  features: string[];
  excluded_features: string[];
  is_lifetime: boolean;
}

export default function CheckoutPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTestMode, setIsTestMode] = useState(false);
  
  // Get the selected plan ID from URL
  const planIdFromUrl = searchParams.get('plan');

  // Check if we're in a preview environment
  const isPreviewEnvironment = window.location.hostname.includes('lovableproject.com');
  
  useEffect(() => {
    // If in preview env, default to test mode
    if (isPreviewEnvironment) {
      setIsTestMode(true);
    }
  }, [isPreviewEnvironment]);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const { data, error } = await supabase
          .from("subscription_plans")
          .select("*")
          .order("price_usd", { ascending: true });

        if (error) throw error;
        
        if (data && data.length > 0) {
          setPlans(data);
          
          // If plan ID is in URL, select that plan
          if (planIdFromUrl) {
            const matchingPlan = data.find(p => p.id === planIdFromUrl);
            if (matchingPlan) {
              setSelectedPlan(matchingPlan);
            } else {
              // If no matching plan, select the first one
              setSelectedPlan(data[0]);
            }
          } else {
            // Default to the first plan if no plan ID in URL
            setSelectedPlan(data[0]);
          }
        }
      } catch (err) {
        console.error("Error fetching plans:", err);
        setError("Failed to load subscription plans. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, [planIdFromUrl]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user && !loading) {
      if (planIdFromUrl) {
        // If there's a selected plan, redirect to signup with plan parameter
        navigate(`/signup?plan=${planIdFromUrl}`);
      } else {
        navigate("/signup?fromCheckout=true");
      }
    }
  }, [user, loading, navigate, planIdFromUrl]);

  const handleTestPayment = async () => {
    try {
      if (!user || !selectedPlan) return;
      
      // Simulate a successful payment
      toast({
        title: "Test Payment Successful",
        description: `Successfully processed test payment for ${selectedPlan.name} plan`,
      });

      // Create subscription in the database
      const { data: subscription, error: subscriptionError } = await supabase
        .from("user_subscriptions")
        .insert({
          user_id: user.id,
          plan_id: selectedPlan.id,
          payment_method: "test_mode",
          status: "active",
          // Set end date for non-lifetime plans
          end_date: selectedPlan.is_lifetime ? null : new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)).toISOString()
        })
        .select()
        .single();

      if (subscriptionError) throw subscriptionError;

      // Record the payment in history
      await supabase
        .from("payment_history")
        .insert({
          user_id: user.id,
          subscription_id: subscription.id,
          payment_method: "test_mode",
          status: "completed",
          payment_id: `test-${Date.now()}`,
          amount_usd: selectedPlan.price_usd,
          amount_kwd: selectedPlan.price_kwd
        });

      // Redirect to success page
      navigate("/payment-success");
    } catch (err) {
      console.error("Error processing test payment:", err);
      toast({
        variant: "destructive",
        title: "Payment Error",
        description: "An error occurred while processing your test payment.",
      });
    }
  };

  // Handle successful PayPal payment
  const handlePayPalSuccess = async (paymentId: string, details: any) => {
    try {
      if (!user || !selectedPlan) return;

      console.log("PayPal payment successful:", { paymentId, details });

      // Create subscription in the database
      const { data: subscription, error: subscriptionError } = await supabase
        .from("user_subscriptions")
        .insert({
          user_id: user.id,
          plan_id: selectedPlan.id,
          payment_method: "paypal",
          status: "active",
          payment_id: paymentId,
          // Set end date for non-lifetime plans
          end_date: selectedPlan.is_lifetime ? null : new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)).toISOString()
        })
        .select()
        .single();

      if (subscriptionError) throw subscriptionError;

      // Record the payment in history
      await supabase
        .from("payment_history")
        .insert({
          user_id: user.id,
          subscription_id: subscription.id,
          payment_method: "paypal",
          status: "completed",
          payment_id: paymentId,
          amount_usd: selectedPlan.price_usd,
          amount_kwd: selectedPlan.price_kwd
        });

      // Redirect to success page
      navigate("/payment-success");
    } catch (err) {
      console.error("Error processing PayPal payment:", err);
      toast({
        variant: "destructive",
        title: "Payment Error",
        description: "An error occurred while processing your payment.",
      });
    }
  };

  // Handle PayPal error
  const handlePayPalError = (error: any) => {
    console.error("PayPal error:", error);
    toast({
      variant: "destructive",
      title: "Payment Error",
      description: "There was an issue with your PayPal payment. Please try again.",
    });
  };

  // Handle successful Tap payment
  const handleTapSuccess = async (paymentId: string) => {
    try {
      if (!user || !selectedPlan) return;

      console.log("Tap payment successful:", paymentId);

      // Create subscription in the database
      const { data: subscription, error: subscriptionError } = await supabase
        .from("user_subscriptions")
        .insert({
          user_id: user.id,
          plan_id: selectedPlan.id,
          payment_method: "tap",
          status: "active",
          payment_id: paymentId,
          // Set end date for non-lifetime plans
          end_date: selectedPlan.is_lifetime ? null : new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)).toISOString()
        })
        .select()
        .single();

      if (subscriptionError) throw subscriptionError;

      // Record the payment in history
      await supabase
        .from("payment_history")
        .insert({
          user_id: user.id,
          subscription_id: subscription.id,
          payment_method: "tap",
          status: "completed",
          payment_id: paymentId,
          amount_usd: selectedPlan.price_usd,
          amount_kwd: selectedPlan.price_kwd
        });

      // Redirect to success page
      navigate("/payment-success");
    } catch (err) {
      console.error("Error processing Tap payment:", err);
      toast({
        variant: "destructive",
        title: "Payment Error",
        description: "An error occurred while processing your payment.",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-3xl mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="mt-4 flex justify-center">
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    );
  }

  // Test mode banner component
  const TestModeBanner = () => (
    <div className={`fixed top-16 inset-x-0 z-50 bg-yellow-400 text-yellow-900 py-2 px-4 text-center 
                    transition-transform ${isTestMode ? 'translate-y-0' : '-translate-y-full'}`}>
      <div className="flex items-center justify-center gap-2">
        <AlertCircle className="h-4 w-4" />
        <span className="font-medium">Test Mode Active</span>
        <Button 
          variant="secondary" 
          size="sm" 
          className="ml-2 bg-yellow-500 hover:bg-yellow-600 text-yellow-900" 
          onClick={() => setIsTestMode(false)}
        >
          Disable Test Mode
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Test mode toggle banner */}
      <TestModeBanner />
      
      <div className={`container max-w-4xl mx-auto p-6 ${isTestMode ? 'mt-12' : ''}`}>
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">Complete Your Purchase</h1>
          <p className="text-muted-foreground">Select a plan and payment method to get started</p>
          
          {/* Show test mode toggle */}
          <div className="mt-4 flex items-center justify-center">
            <span className="text-sm mr-2">Test Mode:</span>
            <Button 
              size="sm"
              variant={isTestMode ? "default" : "outline"}
              onClick={() => setIsTestMode(!isTestMode)}
              className={isTestMode ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {isTestMode ? "ON" : "OFF"}
            </Button>
            <p className="text-xs text-muted-foreground ml-2">
              {isPreviewEnvironment && !isTestMode && "(Recommended for preview)"}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-5 gap-8">
          {/* Left column - Plan selection */}
          <div className="md:col-span-2">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Select a Plan</CardTitle>
                <CardDescription>Choose the plan that's right for you</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {plans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    isSelected={selectedPlan?.id === plan.id}
                    onSelect={() => setSelectedPlan(plan)}
                  />
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Right column - Payment options */}
          <div className="md:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>Payment Method</CardTitle>
                <CardDescription>Select how you'd like to pay</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedPlan && (
                  <div className="mb-6 p-4 bg-muted/20 rounded-lg">
                    <div className="flex justify-between mb-2">
                      <span>Selected Plan:</span>
                      <span className="font-medium">{selectedPlan.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Amount:</span>
                      <span className="font-medium">${selectedPlan.price_usd} ({selectedPlan.price_kwd} KWD)</span>
                    </div>
                  </div>
                )}
                
                {isTestMode ? (
                  <div className="p-4 border border-yellow-300 bg-yellow-50 rounded-lg mb-4">
                    <h3 className="font-medium text-yellow-800 mb-2">Test Mode</h3>
                    <p className="text-sm text-yellow-700 mb-4">
                      Test mode allows you to simulate a successful payment without real charges.
                      Ideal for development and testing environments.
                    </p>
                    <Button 
                      onClick={handleTestPayment}
                      className="w-full bg-yellow-500 hover:bg-yellow-600 text-yellow-900"
                    >
                      Complete Test Payment
                    </Button>
                  </div>
                ) : (
                  <Tabs defaultValue="paypal" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="paypal">PayPal</TabsTrigger>
                      <TabsTrigger value="tap">Tap (KWD)</TabsTrigger>
                    </TabsList>
                    <TabsContent value="paypal" className="pt-4">
                      {selectedPlan && (
                        <PayPalButton
                          amount={selectedPlan.price_usd}
                          planName={selectedPlan.name}
                          onSuccess={handlePayPalSuccess}
                          onError={handlePayPalError}
                        />
                      )}
                    </TabsContent>
                    <TabsContent value="tap" className="pt-4">
                      {selectedPlan && (
                        <TapPaymentButton
                          amount={selectedPlan.price_kwd}
                          planName={selectedPlan.name}
                          onSuccess={handleTapSuccess}
                          userId={user?.id || ""}
                        />
                      )}
                    </TabsContent>
                  </Tabs>
                )}
                
                {isPreviewEnvironment && !isTestMode && (
                  <Alert className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Preview Environment Detected</AlertTitle>
                    <AlertDescription>
                      You're in a preview environment where external payment methods may not work correctly.
                      We recommend using Test Mode for development.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
              <CardFooter className="flex flex-col">
                <Separator className="mb-4" />
                <div className="text-sm text-muted-foreground">
                  By completing this payment, you agree to our 
                  <Button variant="link" size="sm" asChild className="px-1">
                    <a href="/terms-of-service" target="_blank">Terms of Service</a>
                  </Button> 
                  and 
                  <Button variant="link" size="sm" asChild className="px-1">
                    <a href="/privacy-policy" target="_blank">Privacy Policy</a>
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
