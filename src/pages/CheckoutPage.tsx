
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { PlanCard } from "@/components/subscription/PlanCard";
import { PayPalButton } from "@/components/subscription/PayPalButton";
import { TapPaymentButton } from "@/components/subscription/TapPaymentButton";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price_usd: number;
  price_kwd: number;
  duration_days: number | null;
  features: string[];
  excluded_features: string[];
  is_lifetime: boolean;
}

export default function CheckoutPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'paypal' | 'tap'>('paypal');
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [pendingPurchaseInfo, setPendingPurchaseInfo] = useState<{
    paymentId: string;
    planId: string;
    paymentMethod: string;
  } | null>(null);
  
  React.useEffect(() => {
    // Check for pending purchase info in session storage (for users who need to register)
    const storedPurchaseInfo = sessionStorage.getItem('pendingPurchase');
    if (storedPurchaseInfo) {
      const purchaseInfo = JSON.parse(storedPurchaseInfo);
      setPendingPurchaseInfo(purchaseInfo);
      
      // If user is now logged in and we have pending purchase info, complete the purchase
      if (user && purchaseInfo) {
        completePendingPurchase(purchaseInfo);
        // Remove the pending purchase info from session storage
        sessionStorage.removeItem('pendingPurchase');
      }
    }
    
    // Fetch subscription plans
    const fetchPlans = async () => {
      try {
        const { data, error } = await supabase
          .from('subscription_plans')
          .select('*')
          .order('price_usd', { ascending: true });
        
        if (error) throw error;
        
        // Convert JSON strings to arrays before setting state
        const parsedPlans = data?.map(plan => ({
          ...plan,
          features: Array.isArray(plan.features) 
            ? plan.features 
            : (typeof plan.features === 'string' 
                ? JSON.parse(plan.features) 
                : []),
          excluded_features: Array.isArray(plan.excluded_features) 
            ? plan.excluded_features 
            : (typeof plan.excluded_features === 'string' 
                ? JSON.parse(plan.excluded_features) 
                : [])
        })) || [];
        
        setPlans(parsedPlans as SubscriptionPlan[]);
        
        // Select first plan by default
        if (parsedPlans.length > 0 && !selectedPlan) {
          const mostPopularPlan = parsedPlans.find(p => p.name === "Premium") || parsedPlans[0];
          setSelectedPlan(mostPopularPlan as SubscriptionPlan);
        }
      } catch (error) {
        console.error('Error fetching plans:', error);
        toast({
          title: "Error",
          description: "Failed to fetch subscription plans. Please try again later.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchPlans();
  }, [authLoading, user, navigate]);
  
  const completePendingPurchase = async (purchaseInfo: any) => {
    setProcessingPayment(true);
    
    try {
      if (!user) {
        throw new Error("User not logged in");
      }
      
      const { paymentId, planId, paymentMethod } = purchaseInfo;
      
      // Get plan details
      const { data: planData, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', planId)
        .single();
      
      if (planError) throw planError;
      const plan = planData as SubscriptionPlan;
      
      // Calculate end date for non-lifetime plans
      let endDate = null;
      if (!plan.is_lifetime && plan.duration_days) {
        const date = new Date();
        date.setDate(date.getDate() + plan.duration_days);
        endDate = date.toISOString();
      }
      
      // Create subscription record
      const { data: subscription, error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: user.id,
          plan_id: planId,
          payment_method: paymentMethod,
          payment_id: paymentId,
          end_date: endDate,
        })
        .select()
        .single();
      
      if (subscriptionError) throw subscriptionError;
      
      // Create payment history record
      const { error: paymentError } = await supabase
        .from('payment_history')
        .insert({
          user_id: user.id,
          subscription_id: subscription.id,
          amount_usd: plan.price_usd,
          amount_kwd: plan.price_kwd,
          payment_method: paymentMethod,
          payment_id: paymentId,
          status: 'completed',
        });
      
      if (paymentError) throw paymentError;
      
      toast({
        title: "Purchase Completed!",
        description: `Your previous payment has been successfully linked to your account.`,
      });
      
      // Redirect to success page
      navigate('/payment-success');
    } catch (error) {
      console.error('Error processing subscription:', error);
      toast({
        title: "Error",
        description: "Failed to process your subscription. Please contact support.",
        variant: "destructive",
      });
    } finally {
      setProcessingPayment(false);
    }
  };
  
  const handleSelectPlan = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
  };
  
  const handlePaymentSuccess = async (paymentId: string, details: any) => {
    setProcessingPayment(true);
    
    try {
      if (!selectedPlan) {
        throw new Error("No plan selected");
      }
      
      // If the user is not logged in, store purchase info and redirect to signup
      if (!user) {
        // Store the purchase information
        const purchaseInfo = {
          paymentId,
          planId: selectedPlan.id,
          paymentMethod,
          // Do not store sensitive payment details!
        };
        
        // Store in session storage (will be cleared on tab close)
        sessionStorage.setItem('pendingPurchase', JSON.stringify(purchaseInfo));
        
        // Redirect to signup page with a success message
        toast({
          title: "Payment Successful!",
          description: "Please sign up to complete your purchase.",
        });
        
        navigate('/signup?fromCheckout=true');
        return;
      }
      
      // If user is logged in, proceed with subscription creation
      
      // Calculate end date for non-lifetime plans
      let endDate = null;
      if (!selectedPlan.is_lifetime && selectedPlan.duration_days) {
        const date = new Date();
        date.setDate(date.getDate() + selectedPlan.duration_days);
        endDate = date.toISOString();
      }
      
      // Create subscription record
      const { data: subscription, error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: user.id,
          plan_id: selectedPlan.id,
          payment_method: paymentMethod,
          payment_id: paymentId,
          end_date: endDate,
        })
        .select()
        .single();
      
      if (subscriptionError) throw subscriptionError;
      
      // Create payment history record
      const { error: paymentError } = await supabase
        .from('payment_history')
        .insert({
          user_id: user.id,
          subscription_id: subscription.id,
          amount_usd: selectedPlan.price_usd,
          amount_kwd: selectedPlan.price_kwd,
          payment_method: paymentMethod,
          payment_id: paymentId,
          status: 'completed',
        });
      
      if (paymentError) throw paymentError;
      
      toast({
        title: "Payment Successful!",
        description: `Thank you for subscribing to the ${selectedPlan.name} plan.`,
      });
      
      // Redirect to success page
      navigate('/payment-success');
    } catch (error) {
      console.error('Error processing subscription:', error);
      toast({
        title: "Error",
        description: "Failed to process your subscription. Please contact support.",
        variant: "destructive",
      });
    } finally {
      setProcessingPayment(false);
    }
  };
  
  const handlePaymentError = (error: any) => {
    console.error('Payment error:', error);
    toast({
      title: "Payment Failed",
      description: "We couldn't process your payment. Please try again or use a different payment method.",
      variant: "destructive",
    });
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="container max-w-6xl mx-auto py-12 px-4">
      <h1 className="text-3xl md:text-4xl font-bold text-center mb-8">Choose Your Plan</h1>
      
      {/* Step 1: Select Subscription Plan */}
      <div className="mb-12">
        <h2 className="text-xl font-semibold mb-6">Step 1: Select Subscription Plan</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isSelected={selectedPlan?.id === plan.id}
              onSelect={() => handleSelectPlan(plan)}
            />
          ))}
        </div>
      </div>
      
      {/* Step 2: Select Payment Method */}
      {selectedPlan && (
        <div className="mb-12">
          <h2 className="text-xl font-semibold mb-6">Step 2: Select Payment Method</h2>
          <Card>
            <CardContent className="pt-6">
              <RadioGroup defaultValue="paypal" onValueChange={(value) => setPaymentMethod(value as 'paypal' | 'tap')}>
                <div className="flex flex-col space-y-4">
                  <div className="flex items-center space-x-2 border p-4 rounded-md">
                    <RadioGroupItem value="paypal" id="paypal" />
                    <Label htmlFor="paypal" className="font-medium cursor-pointer flex items-center">
                      <svg className="h-6 w-6 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6.5 22H4.75C4.25 22 3.85 21.65 3.75 21.15L1.5 8.5C1.45 8.25 1.5 8 1.65 7.8C1.8 7.6 2.05 7.5 2.3 7.5H6.5C6.5 7.5 6.5 7.5 6.5 7.5C10.25 7.5 12 9.5 12 12.5C12 15.75 9.85 17.5 6.5 17.5H4.5L5.5 22H6.5Z" fill="#3B7BBF"/>
                        <path d="M22.5 8.5L20.25 21.15C20.15 21.65 19.75 22 19.25 22H17.5L18.5 17.5H16.5C13.15 17.5 11 15.75 11 12.5C11 9.5 12.75 7.5 16.5 7.5C16.5 7.5 16.5 7.5 16.5 7.5H20.7C20.95 7.5 21.2 7.6 21.35 7.8C21.5 8 21.55 8.25 21.5 8.5H22.5Z" fill="#253B80"/>
                      </svg>
                      PayPal
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-4 rounded-md">
                    <RadioGroupItem value="tap" id="tap" />
                    <Label htmlFor="tap" className="font-medium cursor-pointer flex items-center">
                      <svg className="h-6 w-6 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="24" height="24" rx="4" fill="#E4E4E4"/>
                        <path d="M5 12H19M9 7L5 12L9 17M15 7L19 12L15 17" stroke="#333333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Tap Payment
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Step 3: Payment Summary */}
      {selectedPlan && (
        <div>
          <h2 className="text-xl font-semibold mb-6">Step 3: Complete Payment</h2>
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Selected Plan:</span>
                  <span className="font-medium">{selectedPlan.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Duration:</span>
                  <span className="font-medium">{selectedPlan.is_lifetime ? 'Lifetime Access' : `${selectedPlan.duration_days} days`}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment Method:</span>
                  <span className="font-medium capitalize">{paymentMethod}</span>
                </div>
                <div className="border-t my-4 pt-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <div>
                      <span className="mr-2">${selectedPlan.price_usd.toFixed(2)}</span>
                      <span className="text-gray-500">({selectedPlan.price_kwd.toFixed(2)} KWD)</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <div className="w-full">
                {processingPayment ? (
                  <Button disabled className="w-full">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </Button>
                ) : (
                  paymentMethod === 'paypal' ? (
                    <PayPalButton
                      amount={selectedPlan.price_usd}
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                      planName={selectedPlan.name}
                    />
                  ) : (
                    <TapPaymentButton
                      amount={selectedPlan.price_kwd}
                      currency="KWD"
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                      planName={selectedPlan.name}
                    />
                  )
                )}
              </div>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
