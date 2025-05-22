import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Container } from "@/components/ui/container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PayPalButton } from "@/components/subscription/PayPalButton";
import { TapPaymentButton } from "@/components/subscription/TapPaymentButton";
import { PlanCard } from "@/components/subscription/PlanCard";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

export default function CheckoutPage() {
  const { user, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const planId = params.get("plan_id");
    if (planId) {
      setSelectedPlanId(planId);
    }
  }, [location]);
  
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      
      try {
        // If we have a plan ID from the URL, fetch that specific plan
        if (selectedPlanId) {
          const { data: planData, error: planError } = await supabase
            .from("subscription_plans")
            .select("*")
            .eq("id", selectedPlanId)
            .single();
          
          if (planError) {
            throw planError;
          }
          
          // Ensure features and excluded_features are arrays, not strings
          if (planData) {
            setPlan({
              ...planData,
              features: Array.isArray(planData.features) 
                ? planData.features 
                : (typeof planData.features === 'string' ? JSON.parse(planData.features) : []),
              excluded_features: Array.isArray(planData.excluded_features)
                ? planData.excluded_features
                : (typeof planData.excluded_features === 'string' ? JSON.parse(planData.excluded_features) : [])
            });
          }
        } else {
          // Otherwise, load the cheapest plan
          const { data: plansData, error: plansError } = await supabase
            .from("subscription_plans")
            .select("*")
            .order("price_usd", { ascending: true })
            .limit(1);
          
          if (plansError) {
            throw plansError;
          }
          
          if (plansData && plansData.length > 0) {
            const planData = plansData[0];
            
            // Ensure features and excluded_features are arrays, not strings
            setPlan({
              ...planData,
              features: Array.isArray(planData.features) 
                ? planData.features 
                : (typeof planData.features === 'string' ? JSON.parse(planData.features) : []),
              excluded_features: Array.isArray(planData.excluded_features)
                ? planData.excluded_features
                : (typeof planData.excluded_features === 'string' ? JSON.parse(planData.excluded_features) : [])
            });
            
            setSelectedPlanId(planData.id);
          }
        }
      } catch (error) {
        console.error("Error loading checkout data:", error);
        toast({
          title: "Error",
          description: "Failed to load plan information.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
    
    if (selectedPlanId || !plan) {
      loadData();
    }
  }, [selectedPlanId]);
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/login?redirect=checkout${selectedPlanId ? `?plan_id=${selectedPlanId}` : ''}`);
    }
  }, [authLoading, user, navigate, selectedPlanId]);
  
  const handlePaymentSuccess = async (paymentId: string, paymentDetails: any = {}, paymentMethod: string = "paypal") => {
    if (!user || !plan) return;
    
    setProcessingPayment(true);
    console.log(`Payment successful with ${paymentMethod}:`, { paymentId, paymentDetails });
    
    try {
      // Calculate end date for non-lifetime plans
      let endDate = null;
      if (!plan.is_lifetime && plan.duration_days) {
        const startDate = new Date();
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + plan.duration_days);
      }
      
      // Check for existing subscription
      const { data: existingSub, error: checkError } = await supabase
        .from('user_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      
      if (checkError && checkError.code !== 'PGRST116') throw checkError;
      
      let subscriptionId;
      
      if (existingSub) {
        // Update existing subscription
        const { data: updatedSub, error: updateError } = await supabase
          .from('user_subscriptions')
          .update({
            plan_id: plan.id,
            end_date: endDate,
            payment_method: paymentMethod,
            payment_id: paymentId,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSub.id)
          .select()
          .single();
        
        if (updateError) throw updateError;
        subscriptionId = updatedSub.id;
      } else {
        // Create new subscription
        const { data: newSub, error: insertError } = await supabase
          .from('user_subscriptions')
          .insert({
            user_id: user.id,
            plan_id: plan.id,
            start_date: new Date().toISOString(),
            end_date: endDate,
            status: 'active',
            payment_method: paymentMethod,
            payment_id: paymentId
          })
          .select()
          .single();
        
        if (insertError) throw insertError;
        subscriptionId = newSub.id;
      }
      
      // Add payment history entry
      await supabase
        .from('payment_history')
        .insert({
          user_id: user.id,
          payment_id: paymentId,
          payment_method: paymentMethod,
          status: 'completed',
          subscription_id: subscriptionId,
          amount_usd: plan.price_usd,
          amount_kwd: plan.price_kwd
        });
      
      // Show success message
      toast({
        title: "Payment Successful",
        description: `You now have access to the ${plan.name} plan!`,
      });
      
      // Navigate to success page
      navigate("/payment-success");
    } catch (error) {
      console.error("Error processing subscription after payment:", error);
      toast({
        title: "Error",
        description: "There was an issue activating your subscription. Please contact support.",
        variant: "destructive",
      });
    } finally {
      setProcessingPayment(false);
    }
  };
  
  const handlePaymentError = (error: any) => {
    console.error("Payment error:", error);
    toast({
      title: "Payment Failed",
      description: "We couldn't process your payment. Please try again or use a different payment method.",
      variant: "destructive",
    });
  };
  
  // Show loading while checking authentication or loading plan data
  if (authLoading || loading) {
    return (
      <Container>
        <div className="min-h-screen flex flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg text-muted-foreground">Loading checkout...</p>
        </div>
      </Container>
    );
  }
  
  // If no plan is selected or available, show an error
  if (!plan) {
    return (
      <Container>
        <div className="min-h-screen flex flex-col items-center justify-center">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-destructive">Plan not found</h1>
            <p className="text-muted-foreground">The selected plan is not available.</p>
            <Button onClick={() => navigate("/pricing")}>View Available Plans</Button>
          </div>
        </div>
      </Container>
    );
  }
  
  return (
    <Container>
      <div className="max-w-4xl mx-auto py-12">
        <h1 className="text-3xl font-bold text-center mb-8">Complete Your Purchase</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Plan details */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Selected Plan</h2>
            <div className="max-w-sm mx-auto">
              <PlanCard 
                plan={plan}
                isSelected={true}
                onSelect={() => {}}
              />
            </div>
          </div>
          
          {/* Payment methods */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Payment Methods</CardTitle>
                <CardDescription>Choose how you want to pay</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* PayPal Button */}
                <div>
                  <h3 className="text-md font-medium mb-3">Pay with PayPal (USD)</h3>
                  <PayPalButton 
                    amount={plan.price_usd} 
                    planName={plan.name}
                    onSuccess={(paymentId, details) => handlePaymentSuccess(paymentId, details, "paypal")}
                    onError={handlePaymentError}
                  />
                </div>
                
                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-muted"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-card px-3 text-sm text-muted-foreground">Or</span>
                  </div>
                </div>
                
                {/* Tap Payment Button */}
                <div>
                  <h3 className="text-md font-medium mb-3">Pay with Tap Payment (KWD)</h3>
                  <TapPaymentButton 
                    amount={plan.price_kwd}
                    planName={plan.name}
                    onSuccess={(paymentId) => handlePaymentSuccess(paymentId, {}, "tap")}
                    onError={handlePaymentError}
                    currency="KWD"
                    userId={user?.id}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Container>
  );
}
