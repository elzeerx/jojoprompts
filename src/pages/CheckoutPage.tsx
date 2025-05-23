
import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { PayPalButton } from "@/components/subscription/PayPalButton";
import { TapPaymentButton } from "@/components/subscription/TapPaymentButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, User } from "lucide-react";
import { Container } from "@/components/ui/container";

export default function CheckoutPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get("plan_id");

  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  
  // Account creation form for new users
  const [createAccount, setCreateAccount] = useState(!user);
  const [accountData, setAccountData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: ""
  });

  useEffect(() => {
    const fetchPlan = async () => {
      if (!planId) {
        navigate("/pricing");
        return;
      }

      try {
        const { data, error } = await supabase
          .from("subscription_plans")
          .select("*")
          .eq("id", planId)
          .single();

        if (error) throw error;
        setPlan(data);
      } catch (error) {
        console.error("Error fetching plan:", error);
        toast({
          title: "Error",
          description: "Failed to load plan details",
          variant: "destructive"
        });
        navigate("/pricing");
      } finally {
        setLoading(false);
      }
    };

    fetchPlan();
  }, [planId, navigate]);

  const handlePaymentSuccess = async (paymentData: any) => {
    setProcessingPayment(true);
    
    try {
      let userId = user?.id;
      
      // If user is not logged in, create account first
      if (!user && createAccount) {
        if (accountData.password !== accountData.confirmPassword) {
          toast({
            title: "Error",
            description: "Passwords do not match",
            variant: "destructive"
          });
          return;
        }

        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: accountData.email,
          password: accountData.password,
          options: {
            data: {
              first_name: accountData.firstName,
              last_name: accountData.lastName
            }
          }
        });

        if (signUpError) throw signUpError;
        
        if (!authData.user) {
          throw new Error("Failed to create user account");
        }
        
        userId = authData.user.id;
      }

      if (!userId) {
        throw new Error("User ID not available");
      }

      // Create subscription
      const { data: subscriptionData, error: subscriptionError } = await supabase.functions.invoke(
        "create-subscription",
        {
          body: {
            planId: plan.id,
            userId: userId,
            paymentData: paymentData
          }
        }
      );

      if (subscriptionError) throw subscriptionError;

      toast({
        title: "Payment Successful!",
        description: `Welcome to ${plan.name}! ${!user ? 'Your account has been created and ' : ''}Your subscription is now active.`
      });

      // Redirect to success page or dashboard
      navigate("/payment-success");
      
    } catch (error) {
      console.error("Payment processing error:", error);
      toast({
        title: "Payment Processing Error",
        description: error.message || "Failed to process payment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  const validateAccountForm = () => {
    if (!accountData.email || !accountData.password || !accountData.firstName) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return false;
    }
    
    if (accountData.password.length < 6) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 6 characters long",
        variant: "destructive"
      });
      return false;
    }
    
    return true;
  };

  if (loading) {
    return (
      <Container className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </Container>
    );
  }

  if (!plan) {
    return (
      <Container className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Plan Not Found</h1>
          <Button onClick={() => navigate("/pricing")}>
            Back to Pricing
          </Button>
        </div>
      </Container>
    );
  }

  return (
    <Container className="min-h-screen py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Complete Your Purchase</h1>
          <p className="text-muted-foreground">
            {user ? "You're almost there!" : "Create your account and get instant access"}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Account Information */}
          {!user && (
            <Card className="border-warm-gold/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-warm-gold" />
                  Create Your Account
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={accountData.firstName}
                      onChange={(e) => setAccountData(prev => ({...prev, firstName: e.target.value}))}
                      placeholder="Enter your first name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={accountData.lastName}
                      onChange={(e) => setAccountData(prev => ({...prev, lastName: e.target.value}))}
                      placeholder="Enter your last name"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={accountData.email}
                    onChange={(e) => setAccountData(prev => ({...prev, email: e.target.value}))}
                    placeholder="Enter your email"
                  />
                </div>
                
                <div>
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={accountData.password}
                    onChange={(e) => setAccountData(prev => ({...prev, password: e.target.value}))}
                    placeholder="Create a password (min. 6 characters)"
                  />
                </div>
                
                <div>
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={accountData.confirmPassword}
                    onChange={(e) => setAccountData(prev => ({...prev, confirmPassword: e.target.value}))}
                    placeholder="Confirm your password"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Plan Summary & Payment */}
          <Card className="border-warm-gold/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-warm-gold" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Plan Details */}
              <div className="bg-warm-gold/5 p-4 rounded-lg border border-warm-gold/10">
                <h3 className="font-semibold text-lg text-warm-gold mb-2">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mb-3">{plan.description}</p>
                
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total:</span>
                  <span className="text-warm-gold">${plan.price_usd}</span>
                </div>
                
                {plan.is_lifetime && (
                  <p className="text-xs text-muted-foreground mt-1">One-time payment • Lifetime access</p>
                )}
              </div>

              <Separator />

              {/* Payment Methods */}
              <div className="space-y-4">
                <h4 className="font-medium">Choose Payment Method</h4>
                
                <div className="space-y-3">
                  <PayPalButton
                    planId={plan.id}
                    amount={plan.price_usd}
                    onSuccess={handlePaymentSuccess}
                    disabled={processingPayment || (!user && !validateAccountForm())}
                    className="w-full"
                  />
                  
                  <TapPaymentButton
                    planId={plan.id}
                    amount={plan.price_kwd}
                    currency="KWD"
                    onSuccess={handlePaymentSuccess}
                    disabled={processingPayment || (!user && !validateAccountForm())}
                    className="w-full"
                  />
                </div>
              </div>

              {processingPayment && (
                <div className="text-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                  Processing your payment...
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Security Notice */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>🔒 Your payment information is encrypted and secure</p>
          <p className="mt-1">By completing this purchase, you agree to our Terms of Service and Privacy Policy</p>
        </div>
      </div>
    </Container>
  );
}
