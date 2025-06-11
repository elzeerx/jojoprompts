
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Play, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';

interface TestResult {
  step: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  timestamp: string;
}

export function PaymentFlowTester() {
  const { user } = useAuth();
  const [planId, setPlanId] = useState('test_plan_basic');
  const [amount, setAmount] = useState('100');
  const [currency, setCurrency] = useState('USD');
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);

  const addResult = (step: string, status: TestResult['status'], message: string) => {
    const result: TestResult = {
      step,
      status,
      message,
      timestamp: new Date().toISOString()
    };
    setTestResults(prev => [...prev, result]);
  };

  const updateLastResult = (status: 'success' | 'error', message: string) => {
    setTestResults(prev => {
      const updated = [...prev];
      if (updated.length > 0) {
        const lastIndex = updated.length - 1;
        updated[lastIndex] = {
          ...updated[lastIndex],
          status,
          message
        };
      }
      return updated;
    });
  };

  const testCompletePaymentFlow = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "Please log in to test payment flow",
        variant: "destructive",
      });
      return;
    }

    try {
      setTesting(true);
      setTestResults([]);

      // Step 1: Create Tap Payment
      addResult('payment_creation', 'pending', 'Creating Tap payment session...');
      
      const { data: paymentData, error: paymentError } = await supabase.functions.invoke('create-tap-payment', {
        body: { 
          planId,
          userId: user.id,
          amount: parseFloat(amount),
          currency: currency.toLowerCase()
        }
      });

      if (paymentError) {
        updateLastResult('error', `Payment creation failed: ${paymentError.message}`);
        throw new Error(`Payment creation failed: ${paymentError.message}`);
      }

      updateLastResult('success', `Payment session created with ID: ${paymentData.id}`);

      // Step 2: Simulate webhook verification
      addResult('webhook_simulation', 'pending', 'Simulating webhook verification...');
      
      const webhookPayload = {
        id: paymentData.id,
        status: 'CAPTURED',
        amount: parseFloat(amount),
        currency: currency,
        metadata: {
          user_id: user.id,
          plan_id: planId
        },
        customer: {
          email: user.email
        }
      };

      const { data: webhookData, error: webhookError } = await supabase.functions.invoke('tap-webhook', {
        body: webhookPayload
      });

      if (webhookError) {
        updateLastResult('error', `Webhook simulation failed: ${webhookError.message}`);
        throw new Error(`Webhook simulation failed: ${webhookError.message}`);
      }

      updateLastResult('success', 'Webhook processed successfully');

      // Step 3: Verify subscription creation
      addResult('subscription_verification', 'pending', 'Verifying subscription creation...');
      
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('tap_charge', paymentData.id)
        .single();

      if (subError || !subscription) {
        updateLastResult('error', 'Subscription not found in database');
        throw new Error('Subscription verification failed');
      }

      updateLastResult('success', `Subscription created with status: ${subscription.status}`);

      // Step 4: Verify payment log
      addResult('payment_log_verification', 'pending', 'Verifying payment log...');
      
      const { data: paymentLog, error: logError } = await supabase
        .from('payments_log')
        .select('*')
        .eq('user_id', user.id)
        .eq('tap_charge', paymentData.id)
        .single();

      if (logError || !paymentLog) {
        updateLastResult('error', 'Payment log not found');
        throw new Error('Payment log verification failed');
      }

      updateLastResult('success', `Payment logged with status: ${paymentLog.status}`);

      toast({
        title: "Payment Flow Test Successful",
        description: "All payment flow steps completed successfully",
      });

    } catch (error: any) {
      console.error('Payment flow test error:', error);
      toast({
        title: "Payment Flow Test Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-gray-600">Please log in to test payment flow</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          Complete Payment Flow Testing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Test Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="planId">Plan ID</Label>
            <Input
              id="planId"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              placeholder="test_plan_basic"
            />
          </div>
          <div>
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100"
            />
          </div>
          <div>
            <Label htmlFor="currency">Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="AED">AED</SelectItem>
                <SelectItem value="SAR">SAR</SelectItem>
                <SelectItem value="KWD">KWD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Test Execution */}
        <div className="flex justify-center">
          <Button
            onClick={testCompletePaymentFlow}
            disabled={testing}
            size="lg"
            className="w-full md:w-auto"
          >
            {testing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing Payment Flow...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Complete Payment Flow Test
              </>
            )}
          </Button>
        </div>

        {/* Test Results */}
        {testResults.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold">Test Results</h3>
            <div className="space-y-2">
              {testResults.map((result, index) => (
                <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                  {getStatusIcon(result.status)}
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <span className="font-medium capitalize">
                        {result.step.replace('_', ' ')}
                      </span>
                      <Badge variant={result.status === 'success' ? 'default' : result.status === 'error' ? 'destructive' : 'secondary'}>
                        {result.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{result.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Test Description */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-800">What this test does:</p>
              <ul className="text-sm text-blue-700 mt-1 space-y-1">
                <li>• Creates a Tap payment session</li>
                <li>• Simulates webhook processing</li>
                <li>• Verifies subscription creation in database</li>
                <li>• Confirms payment logging</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
