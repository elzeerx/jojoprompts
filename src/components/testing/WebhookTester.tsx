
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
import { Webhook, Play, AlertTriangle } from 'lucide-react';

interface WebhookTemplate {
  id: string;
  name: string;
  status: string;
  description: string;
  variant: 'default' | 'destructive' | 'secondary';
}

const WEBHOOK_TEMPLATES: WebhookTemplate[] = [
  {
    id: 'captured',
    name: 'Payment Captured',
    status: 'CAPTURED',
    description: 'Successful payment completion',
    variant: 'default'
  },
  {
    id: 'failed',
    name: 'Payment Failed',
    status: 'FAILED',
    description: 'Payment declined or failed',
    variant: 'destructive'
  },
  {
    id: 'pending',
    name: 'Payment Pending',
    status: 'PENDING',
    description: 'Payment still processing',
    variant: 'secondary'
  },
  {
    id: 'cancelled',
    name: 'Payment Cancelled',
    status: 'CANCELLED',
    description: 'Payment cancelled by user',
    variant: 'destructive'
  }
];

export function WebhookTester() {
  const { user } = useAuth();
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [chargeId, setChargeId] = useState('');
  const [amount, setAmount] = useState('100');
  const [currency, setCurrency] = useState('USD');
  const [testing, setTesting] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const generateTestPayload = (templateId: string) => {
    const template = WEBHOOK_TEMPLATES.find(t => t.id === templateId);
    if (!template || !user) return null;

    const testChargeId = chargeId || `test_chg_${Date.now()}_${templateId}`;
    
    return {
      id: testChargeId,
      status: template.status,
      amount: parseFloat(amount) || 100,
      currency: currency,
      created: new Date().toISOString(),
      metadata: {
        user_id: user.id,
        plan_id: 'test_plan_id',
        test_mode: true
      },
      customer: {
        id: `test_customer_${user.id}`,
        email: user.email || 'test@example.com'
      },
      source: {
        type: 'card',
        brand: 'visa',
        last_four: '4242'
      }
    };
  };

  const testWebhook = async (templateId: string) => {
    if (!user) {
      toast({
        title: "Error",
        description: "Please log in to test webhooks",
        variant: "destructive",
      });
      return;
    }

    const payload = generateTestPayload(templateId);
    if (!payload) return;

    try {
      setTesting(true);
      
      console.log('Testing webhook with payload:', payload);
      
      // Simulate webhook call
      const response = await fetch('/functions/v1/tap-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'hashstring': 'test_signature_' + Date.now(), // Mock signature for testing
        },
        body: JSON.stringify(payload)
      });

      const result = await response.text();
      
      setLastResult({
        template: templateId,
        payload,
        response: {
          status: response.status,
          statusText: response.statusText,
          body: result
        },
        timestamp: new Date().toISOString()
      });

      if (response.ok) {
        toast({
          title: "Webhook Test Successful",
          description: `${WEBHOOK_TEMPLATES.find(t => t.id === templateId)?.name} webhook processed`,
        });
      } else {
        toast({
          title: "Webhook Test Failed",
          description: `Status: ${response.status} - ${result}`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Webhook test error:', error);
      
      setLastResult({
        template: templateId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      toast({
        title: "Webhook Test Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-gray-600">Please log in to access webhook testing</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhook Testing Utility
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="chargeId">Charge ID (optional)</Label>
              <Input
                id="chargeId"
                placeholder="Auto-generated if empty"
                value={chargeId}
                onChange={(e) => setChargeId(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                placeholder="100"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          {/* Template Selection */}
          <div>
            <Label>Webhook Templates</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              {WEBHOOK_TEMPLATES.map((template) => (
                <Card key={template.id} className="border cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium">{template.name}</h4>
                      <Badge variant={template.variant}>
                        {template.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      {template.description}
                    </p>
                    <Button
                      onClick={() => testWebhook(template.id)}
                      disabled={testing}
                      size="sm"
                      className="w-full"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      {testing ? 'Testing...' : 'Test Webhook'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Results */}
          {lastResult && (
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {lastResult.error ? (
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  ) : (
                    <Webhook className="h-5 w-5 text-green-500" />
                  )}
                  Last Test Result
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Template:</span>
                    <Badge>
                      {WEBHOOK_TEMPLATES.find(t => t.id === lastResult.template)?.name || lastResult.template}
                    </Badge>
                  </div>
                  
                  <div>
                    <span className="font-medium">Timestamp:</span>
                    <span className="ml-2 text-sm text-gray-600">
                      {new Date(lastResult.timestamp).toLocaleString()}
                    </span>
                  </div>

                  {lastResult.error ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h4 className="font-medium text-red-800 mb-2">Error:</h4>
                      <pre className="text-sm text-red-700 overflow-x-auto">
                        {lastResult.error}
                      </pre>
                    </div>
                  ) : (
                    <>
                      <div className="bg-gray-50 border rounded-lg p-4">
                        <h4 className="font-medium mb-2">Payload Sent:</h4>
                        <pre className="text-sm overflow-x-auto">
                          {JSON.stringify(lastResult.payload, null, 2)}
                        </pre>
                      </div>
                      
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-medium text-blue-800 mb-2">Response:</h4>
                        <div className="text-sm">
                          <div><strong>Status:</strong> {lastResult.response.status}</div>
                          <div><strong>Status Text:</strong> {lastResult.response.statusText}</div>
                          <div><strong>Body:</strong></div>
                          <pre className="mt-2 overflow-x-auto">
                            {lastResult.response.body}
                          </pre>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
