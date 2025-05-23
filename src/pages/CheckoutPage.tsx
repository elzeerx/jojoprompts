
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Check, Crown } from "lucide-react";
import { PayPalButton } from "@/components/subscription/PayPalButton";
import { TapPaymentButton } from "@/components/subscription/TapPaymentButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get("plan");
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

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

        setSelectedPlan(data);
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

    fetchPlan();
  }, [planId, navigate]);

  const handlePaymentSuccess = async (paymentData: any) => {
    try {
      const { data, error } = await supabase.functions.invoke("create-subscription", {
        body: {
          planId: selectedPlan.id,
          userId: user?.id,
          paymentData
        }
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Your subscription has been activated",
      });

      navigate("/dashboard");
    } catch (error) {
      console.error("Error creating subscription:", error);
      toast({
        title: "Error",
        description: "Failed to activate subscription",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!selectedPlan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Plan not found</h1>
          <Button onClick={() => navigate("/pricing")}>
            Back to Pricing
          </Button>
        </div>
      </div>
    );
  }

  const price = selectedPlan.price_usd;
  const features = Array.isArray(selectedPlan.features) ? selectedPlan.features : [];

  return (
    <div className="min-h-screen bg-soft-bg py-16">
      <div className="container mx-auto max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Complete Your Purchase</h1>
          <p className="text-muted-foreground">
            You're about to subscribe to the {selectedPlan.name} plan
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
                  {!selectedPlan.is_lifetime && (
                    <span className="text-lg text-muted-foreground">
                      /{selectedPlan.duration_days === 30 ? "month" : "year"}
                    </span>
                  )}
                  {selectedPlan.is_lifetime && (
                    <span className="text-lg text-muted-foreground"> one-time</span>
                  )}
                </div>
                <p className="text-muted-foreground mt-2">
                  {selectedPlan.description}
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Included Features:</h4>
                <ul className="space-y-1">
                  {features.map((feature: string, index: number) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-600" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card>
            <CardHeader>
              <CardTitle>Choose Payment Method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-3">PayPal</h4>
                  <PayPalButton
                    amount={price}
                    onSuccess={handlePaymentSuccess}
                    className="w-full"
                  />
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Credit Card (Tap Payments)</h4>
                  <TapPaymentButton
                    amount={price}
                    onSuccess={handlePaymentSuccess}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-8">
          <Button
            variant="outline"
            onClick={() => navigate("/pricing")}
            className="mr-4"
          >
            Back to Pricing
          </Button>
        </div>
      </div>
    </div>
  );
}
