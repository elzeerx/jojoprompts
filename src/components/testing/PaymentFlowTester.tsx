import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { RefreshCw, CreditCard, CheckCircle, XCircle } from 'lucide-react';

interface TestPlan {
  id: string;
  name: string;
  price_usd: number;
  is_lifetime: boolean;
}

export function PaymentFlowTester() {
  const { user } = useAuth();
  const { isActive, planName, expiresAt, isLifetime, loading, refresh } = useSubscriptionStatus();
  const [testPlans, setTestPlans] = useState<TestPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [testingPayment, setTestingPayment] = useState<string | null>(null);

  const fetchTestPlans = async () => {
    if (!user) return;
    
    try {
      setLoadingPlans(true);
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('id, name, price_usd, is_lifetime')
        .order('price_usd', { ascending: true });

      if (error) throw error;
      setTestPlans(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load test plans",
        variant: "destructive",
      });
    } finally {
      setLoadingPlans(false);
    }
  };

  const testPaymentFlow = async (planId: string) => {
    if (!user) return;
    
    try {
      setTestingPayment(planId);
      
      // Simulate a successful payment by directly creating a subscription
      const selectedPlan = testPlans.find(p => p.id === planId);
      if (!selectedPlan) throw new Error('Plan not found');

      // Calculate end date for non-lifetime plans
      let endDate = null;
      if (!selectedPlan.is_lifetime) {
        const startDate = new Date();
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 30); // 30 days from now
      }

      // Create subscription record
      const { error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: user.id,
          plan_id: planId,
          start_date: new Date().toISOString(),
          end_date: endDate?.toISOString() || null,
          status: 'active',
          payment_method: 'test_payment'
        });

      if (subscriptionError) throw subscriptionError;

      // Create payment history record
      const { error: paymentError } = await supabase
        .from('payment_history')
        .insert({
          user_id: user.id,
          amount_usd: selectedPlan.price_usd,
          status: 'completed',
          payment_method: 'test_payment'
        });

      if (paymentError) throw paymentError;

      toast({
        title: "Test Payment Successful",
        description: `Successfully activated ${selectedPlan.name}`,
      });

      // Refresh subscription status
      refresh();
    } catch (error: any) {
      toast({
        title: "Test Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTestingPayment(null);
    }
  };

  const cancelCurrentSubscription = async () => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('user_subscriptions')
        .update({ status: 'cancelled' })
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (error) throw error;

      toast({
        title: "Subscription Cancelled",
        description: "Test subscription has been cancelled",
      });

      refresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to cancel subscription",
        variant: "destructive",
      });
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-gray-600">Please log in to test payment flows</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Flow Tester
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={fetchTestPlans} disabled={loadingPlans}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Load Test Plans
            </Button>
            {isActive && (
              <Button onClick={cancelCurrentSubscription} variant="destructive">
                Cancel Current Subscription
              </Button>
            )}
          </div>

          {/* Current Subscription Status */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">Current Status</h3>
            <div className="flex items-center gap-2">
              {loading ? (
                <span>Loading...</span>
              ) : isActive ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Active: {planName}</span>
                  {!isLifetime && expiresAt && (
                    <Badge variant="outline">
                      Expires: {new Date(expiresAt).toLocaleDateString()}
                    </Badge>
                  )}
                  {isLifetime && (
                    <Badge className="bg-green-100 text-green-800">Lifetime</Badge>
                  )}
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-gray-500" />
                  <span>No active subscription</span>
                </>
              )}
            </div>
          </div>

          {/* Test Plans */}
          {testPlans.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Test Plans</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {testPlans.map((plan) => (
                  <Card key={plan.id} className="border">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium">{plan.name}</h4>
                        {plan.is_lifetime && (
                          <Badge className="bg-yellow-100 text-yellow-800">Lifetime</Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mb-3">
                        ${plan.price_usd} USD
                      </div>
                      <Button
                        onClick={() => testPaymentFlow(plan.id)}
                        disabled={testingPayment === plan.id}
                        size="sm"
                        className="w-full"
                      >
                        {testingPayment === plan.id ? 'Testing...' : 'Test Payment'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
