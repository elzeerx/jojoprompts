
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TapPaymentTester } from '@/components/testing/TapPaymentTester';
import { WebhookTester } from '@/components/testing/WebhookTester';
import { PaymentFlowTester } from '@/components/testing/PaymentFlowTester';
import { useAuth } from '@/contexts/AuthContext';
import { TestTube, Shield, AlertTriangle } from 'lucide-react';

export default function TestingDashboard() {
  const { isAdmin, isJadmin } = useAuth();

  if (!isAdmin && !isJadmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-red-600">
              <Shield className="h-5 w-5" />
              Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600">
              You need admin privileges to access the testing dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Testing Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Comprehensive testing tools for Tap payment integration
          </p>
        </div>
        <Badge variant="destructive" className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Admin Only
        </Badge>
      </div>

      {/* Testing Environment Warning */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <TestTube className="h-5 w-5 text-yellow-600" />
            <div>
              <h3 className="font-medium text-yellow-800">Testing Environment</h3>
              <p className="text-sm text-yellow-700">
                Use Tap's sandbox environment and test card numbers. Real payments will not be processed.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="payment-flow" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="payment-flow">Payment Flow</TabsTrigger>
          <TabsTrigger value="tap-testing">Tap Testing</TabsTrigger>
          <TabsTrigger value="webhook-testing">Webhook Testing</TabsTrigger>
          <TabsTrigger value="scenarios">Test Scenarios</TabsTrigger>
        </TabsList>

        <TabsContent value="payment-flow" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Flow Testing</CardTitle>
              <p className="text-sm text-gray-600">
                Test the complete payment flow with subscription creation and validation
              </p>
            </CardHeader>
            <CardContent>
              <PaymentFlowTester />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tap-testing" className="space-y-6">
          <TapPaymentTester />
        </TabsContent>

        <TabsContent value="webhook-testing" className="space-y-6">
          <WebhookTester />
        </TabsContent>

        <TabsContent value="scenarios" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Test Scenarios Matrix</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Success Scenarios */}
              <div>
                <h3 className="font-semibold text-green-700 mb-3">✅ Success Scenarios</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border-green-200">
                    <CardContent className="p-4">
                      <h4 className="font-medium">Standard Success Flow</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Card: 4242 4242 4242 4242
                      </p>
                      <p className="text-sm text-gray-600">
                        Expected: CAPTURED → /payment/success
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-green-200">
                    <CardContent className="p-4">
                      <h4 className="font-medium">Webhook Recovery</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Close tab mid-payment
                      </p>
                      <p className="text-sm text-gray-600">
                        Expected: CAPTURED via webhook → /payment/success
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Failure Scenarios */}
              <div>
                <h3 className="font-semibold text-red-700 mb-3">❌ Failure Scenarios</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border-red-200">
                    <CardContent className="p-4">
                      <h4 className="font-medium">3DS Cancellation</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Force cancel 3-DS authentication
                      </p>
                      <p className="text-sm text-gray-600">
                        Expected: FAILED → /payment/failed
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-red-200">
                    <CardContent className="p-4">
                      <h4 className="font-medium">Declined Card</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Card: 4000 0000 0000 0002
                      </p>
                      <p className="text-sm text-gray-600">
                        Expected: FAILED → /payment/failed
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Edge Cases */}
              <div>
                <h3 className="font-semibold text-yellow-700 mb-3">⚠️ Edge Cases</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border-yellow-200">
                    <CardContent className="p-4">
                      <h4 className="font-medium">Network Timeout</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Simulate network interruption
                      </p>
                      <p className="text-sm text-gray-600">
                        Expected: Graceful error handling
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-yellow-200">
                    <CardContent className="p-4">
                      <h4 className="font-medium">Duplicate Webhook</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Send same webhook twice
                      </p>
                      <p className="text-sm text-gray-600">
                        Expected: Idempotent handling
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
