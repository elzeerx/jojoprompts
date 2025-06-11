
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { CreditCard, TestTube, Webhook, Database } from 'lucide-react';

interface TestScenario {
  id: string;
  name: string;
  cardNumber: string;
  description: string;
  expectedResult: string;
  testType: 'success' | 'failure' | 'webhook';
}

const TEST_SCENARIOS: TestScenario[] = [
  {
    id: 'success',
    name: 'Success Test',
    cardNumber: '4242 4242 4242 4242',
    description: 'Should result in CAPTURED → /payment/success',
    expectedResult: 'CAPTURED',
    testType: 'success'
  },
  {
    id: 'failure',
    name: 'Failure Test',
    cardNumber: 'Force cancel 3-DS',
    description: 'Should result in FAILED → /payment/failed',
    expectedResult: 'FAILED',
    testType: 'failure'
  },
  {
    id: 'webhook',
    name: 'Webhook Test',
    cardNumber: 'Close tab mid-pay',
    description: 'Should result in CAPTURED via webhook → /payment/success',
    expectedResult: 'CAPTURED (via webhook)',
    testType: 'webhook'
  }
];

export function TapPaymentTester() {
  const { user } = useAuth();
  const [testChargeId, setTestChargeId] = useState('');
  const [webhookPayload, setWebhookPayload] = useState('');
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const testChargeVerification = async () => {
    if (!testChargeId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a charge ID to test",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading({ ...loading, verification: true });
      
      const { data, error } = await supabase.functions.invoke('tap-confirm', {
        body: { charge_id: testChargeId }
      });

      if (error) throw error;

      setTestResults({ ...testResults, verification: data });
      
      toast({
        title: "Test Complete",
        description: `Charge status: ${data?.status || 'Unknown'}`,
      });
    } catch (error: any) {
      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading({ ...loading, verification: false });
    }
  };

  const testWebhookSimulation = async () => {
    if (!webhookPayload.trim()) {
      toast({
        title: "Error",
        description: "Please enter webhook payload",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading({ ...loading, webhook: true });
      
      const payload = JSON.parse(webhookPayload);
      
      // Simulate webhook call (in real scenario, this would be called by Tap)
      const { data, error } = await supabase.functions.invoke('tap-webhook', {
        body: payload
      });

      if (error) throw error;

      setTestResults({ ...testResults, webhook: data });
      
      toast({
        title: "Webhook Test Complete",
        description: "Webhook simulation executed successfully",
      });
    } catch (error: any) {
      toast({
        title: "Webhook Test Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading({ ...loading, webhook: false });
    }
  };

  const checkDatabaseState = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "Please log in to check database state",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading({ ...loading, database: true });
      
      // Check subscriptions
      const { data: subscriptions, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id);

      if (subError) throw subError;

      // Check payment logs
      const { data: paymentLogs, error: logError } = await supabase
        .from('payments_log')
        .select('*')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: false })
        .limit(5);

      if (logError) throw logError;

      setTestResults({ 
        ...testResults, 
        database: { 
          subscriptions: subscriptions || [], 
          paymentLogs: paymentLogs || [] 
        } 
      });
      
      toast({
        title: "Database Check Complete",
        description: `Found ${subscriptions?.length || 0} subscriptions and ${paymentLogs?.length || 0} payment logs`,
      });
    } catch (error: any) {
      toast({
        title: "Database Check Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading({ ...loading, database: false });
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-gray-600">Please log in to access testing tools</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Test Scenarios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Sandbox Test Scenarios
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TEST_SCENARIOS.map((scenario) => (
              <Card key={scenario.id} className="border">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium">{scenario.name}</h4>
                    <Badge 
                      variant={scenario.testType === 'success' ? 'default' : 
                              scenario.testType === 'failure' ? 'destructive' : 'secondary'}
                    >
                      {scenario.testType}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    <strong>Card:</strong> {scenario.cardNumber}
                  </div>
                  <div className="text-sm text-gray-600 mb-3">
                    {scenario.description}
                  </div>
                  <div className="text-xs bg-gray-50 p-2 rounded">
                    <strong>Expected:</strong> {scenario.expectedResult}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Charge Verification Testing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Verification Testing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="chargeId">Charge ID</Label>
              <Input
                id="chargeId"
                placeholder="Enter Tap charge ID (e.g., chg_TS07A0220231433Ql241910314)"
                value={testChargeId}
                onChange={(e) => setTestChargeId(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={testChargeVerification}
                disabled={loading.verification}
              >
                {loading.verification ? 'Testing...' : 'Test Verification'}
              </Button>
            </div>
          </div>
          
          {testResults.verification && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Verification Result:</h4>
              <pre className="text-sm overflow-x-auto">
                {JSON.stringify(testResults.verification, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhook Testing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhook Testing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="webhookPayload">Webhook Payload (JSON)</Label>
            <textarea
              id="webhookPayload"
              className="w-full h-32 p-3 border rounded-md font-mono text-sm"
              placeholder={`{
  "id": "chg_TS07A0220231433Ql241910314",
  "status": "CAPTURED",
  "amount": 100,
  "currency": "USD",
  "metadata": {
    "user_id": "${user?.id || 'user-id'}",
    "plan_id": "plan-id"
  }
}`}
              value={webhookPayload}
              onChange={(e) => setWebhookPayload(e.target.value)}
            />
          </div>
          <Button 
            onClick={testWebhookSimulation}
            disabled={loading.webhook}
          >
            {loading.webhook ? 'Testing...' : 'Simulate Webhook'}
          </Button>
          
          {testResults.webhook && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Webhook Result:</h4>
              <pre className="text-sm overflow-x-auto">
                {JSON.stringify(testResults.webhook, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Database Validation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Validation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={checkDatabaseState}
            disabled={loading.database}
          >
            {loading.database ? 'Checking...' : 'Check Database State'}
          </Button>
          
          {testResults.database && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Subscriptions ({testResults.database.subscriptions.length}):</h4>
                <pre className="text-sm overflow-x-auto">
                  {JSON.stringify(testResults.database.subscriptions, null, 2)}
                </pre>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Recent Payment Logs ({testResults.database.paymentLogs.length}):</h4>
                <pre className="text-sm overflow-x-auto">
                  {JSON.stringify(testResults.database.paymentLogs, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
