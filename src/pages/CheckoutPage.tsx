
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Container } from "@/components/ui/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Star, Zap, Crown } from "lucide-react";
import { PayPalButton } from "@/components/subscription/PayPalButton";
import { TapPaymentButton } from "@/components/subscription/TapPaymentButton";
import { toast } from "@/hooks/use-toast";

interface Plan {
  id: string;
  name: string;
  price: number;
  features: string[];
  popular?: boolean;
  description?: string;
}

export default function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);

  const planId = searchParams.get("plan");

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    if (!planId) {
      navigate("/pricing");
      return;
    }

    fetchPlan();
  }, [user, planId, navigate]);

  const fetchPlan = async () => {
    try {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("id", planId)
        .single();

      if (error) throw error;

      const transformedPlan: Plan = {
        id: data.id,
        name: data.name,
        price: data.price,
        features: data.features || [],
        description: data.description,
      };

      setPlan(transformedPlan);
    } catch (error) {
      console.error("Error fetching plan:", error);
      toast({
        title: "Error",
        description: "Failed to load plan details",
        variant: "destructive",
      });
      navigate("/pricing");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (paymentData: any) => {
    try {
      console.log("Payment successful:", paymentData);
      
      // Create user subscription
      const { error } = await supabase
        .from("user_subscriptions")
        .insert({
          user_id: user!.id,
          plan_id: plan!.id,
          status: "active",
          payment_method: paymentData.payment_method || "paypal",
        });

      if (error) throw error;

      toast({
        title: "Payment Successful!",
        description: "Your subscription has been activated.",
      });

      navigate("/payment-success");
    } catch (error) {
      console.error("Error creating subscription:", error);
      toast({
        title: "Error",
        description: "Payment was successful but there was an error activating your subscription. Please contact support.",
        variant: "destructive",
      });
    }
  };

  const getPlanIcon = (planName: string) => {
    switch (planName.toLowerCase()) {
      case "basic":
        return <Star className="h-8 w-8 text-blue-500" />;
      case "standard":
        return <Zap className="h-8 w-8 text-green-500" />;
      case "premium":
        return <Crown className="h-8 w-8 text-purple-500" />;
      case "ultimate":
        return <Crown className="h-8 w-8 text-warm-gold" />;
      default:
        return <Star className="h-8 w-8 text-gray-500" />;
    }
  };

  const getPlanColor = (planName: string) => {
    switch (planName.toLowerCase()) {
      case "basic":
        return "border-blue-200 bg-blue-50";
      case "standard":
        return "border-green-200 bg-green-50";
      case "premium":
        return "border-purple-200 bg-purple-50";
      case "ultimate":
        return "border-warm-gold/30 bg-warm-gold/10";
      default:
        return "border-gray-200 bg-gray-50";
    }
  };

  if (loading) {
    return (
      <Container>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-warm-gold mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading checkout...</p>
          </div>
        </div>
      </Container>
    );
  }

  if (!plan) {
    return (
      <Container>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Plan Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The requested plan could not be found.
          </p>
          <button
            onClick={() => navigate("/pricing")}
            className="bg-warm-gold hover:bg-warm-gold/90 text-white px-6 py-2 rounded-lg font-medium"
          >
            View All Plans
          </button>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className="max-w-4xl mx-auto py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Complete Your Purchase</h1>
          <p className="text-xl text-muted-foreground">
            You're just one step away from accessing premium prompts
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Plan Summary */}
          <div>
            <h2 className="text-2xl font-bold mb-6">Order Summary</h2>
            <Card className={`${getPlanColor(plan.name)} border-2`}>
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-4">
                  {getPlanIcon(plan.name)}
                </div>
                <CardTitle className="text-2xl">
                  {plan.name} Plan
                  {plan.popular && (
                    <Badge className="ml-2 bg-warm-gold text-white">
                      Most Popular
                    </Badge>
                  )}
                </CardTitle>
                <div className="text-4xl font-bold text-warm-gold">
                  ${plan.price}
                  {plan.name.toLowerCase() !== "ultimate" && (
                    <span className="text-lg text-muted-foreground">/month</span>
                  )}
                  {plan.name.toLowerCase() === "ultimate" && (
                    <span className="text-lg text-muted-foreground"> one-time</span>
                  )}
                </div>
                {plan.description && (
                  <p className="text-muted-foreground mt-2">{plan.description}</p>
                )}
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Payment Options */}
          <div>
            <h2 className="text-2xl font-bold mb-6">Payment Method</h2>
            <div className="space-y-4">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <img
                    src="https://www.paypalobjects.com/webstatic/mktg/Logo/pp-logo-100px.png"
                    alt="PayPal"
                    className="h-6"
                  />
                  Pay with PayPal
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Secure payment processing through PayPal. You can use your PayPal account or pay with a credit/debit card.
                </p>
                <PayPalButton
                  amount={plan.price}
                  currency="USD"
                  onSuccess={handlePaymentSuccess}
                  className="w-full"
                />
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <div className="w-8 h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">T</span>
                  </div>
                  Pay with Tap
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Fast and secure payment processing for the Middle East region.
                </p>
                <TapPaymentButton
                  amount={plan.price}
                  currency="USD"
                  onSuccess={handlePaymentSuccess}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                />
              </Card>
            </div>

            <div className="mt-8 p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <Check className="h-3 w-3 text-white" />
                </div>
                <span className="text-sm font-medium">Secure Payment</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Your payment information is encrypted and secure. We never store your payment details.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}
