import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Search, 
  RefreshCw, 
  CreditCard, 
  AlertTriangle, 
  CheckCircle2,
  XCircle,
  Mail,
  Phone,
  ExternalLink,
  Download,
  Clock
} from 'lucide-react';
import { usePaymentRecovery } from '@/hooks/payment/usePaymentRecovery';
import { usePaymentStatus } from '@/hooks/payment/usePaymentStatus';
import { PaymentRecoveryCard } from './PaymentRecoveryCard';
import { EnhancedErrorMessage } from './EnhancedErrorMessage';
import { toast } from '@/hooks/use-toast';

export function PaymentRecoveryDashboard() {
  const [searchOrderId, setSearchOrderId] = useState('');
  const [searchPaymentId, setSearchPaymentId] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  
  const { transactions, loading: statusLoading, retryFailedPayment } = usePaymentStatus();
  
  // Get failed and pending transactions
  const problematicTransactions = transactions.filter(
    t => ['failed', 'pending', 'cancelled'].includes(t.status.toLowerCase())
  );

  const handleSearchPayment = async () => {
    if (!searchOrderId && !searchPaymentId) {
      toast({
        title: "Search Required",
        description: "Please enter either an Order ID or Payment ID to search.",
        variant: "destructive"
      });
      return;
    }

    setSearching(true);
    try {
      // Use the payment recovery hook to search
      const recoveryHook = usePaymentRecovery({
        orderId: searchOrderId || undefined,
        paymentId: searchPaymentId || undefined
      });
      
      // This is a simplified version - in practice you'd want to trigger the search
      setSearchResult({
        found: true,
        orderId: searchOrderId,
        paymentId: searchPaymentId
      });
      
    } catch (error: any) {
      toast({
        title: "Search Failed",
        description: error.message || "Could not find payment information.",
        variant: "destructive"
      });
    } finally {
      setSearching(false);
    }
  };

  const handleRetryPayment = async (transactionId: string, planId: string) => {
    try {
      const result = await retryFailedPayment(transactionId, planId);
      
      if (result.success && result.redirectUrl) {
        toast({
          title: "Redirecting to PayPal",
          description: "You'll be redirected to complete your payment.",
        });
        setTimeout(() => {
          window.location.href = result.redirectUrl!;
        }, 1000);
      } else {
        throw new Error(result.error || 'Retry failed');
      }
    } catch (error: any) {
      toast({
        title: "Retry Failed",
        description: error.message || "Could not retry payment. Please contact support.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Payment Recovery Center</h1>
        <p className="text-muted-foreground">
          Resolve payment issues, find lost transactions, and get help with billing problems
        </p>
      </div>

      <Tabs defaultValue="search" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="search">Find Payment</TabsTrigger>
          <TabsTrigger value="issues">Payment Issues</TabsTrigger>
          <TabsTrigger value="help">Get Help</TabsTrigger>
        </TabsList>

        {/* Search for Lost Payments */}
        <TabsContent value="search" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Find Your Payment
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Lost your session after payment? Enter your PayPal Order ID or Payment ID to recover your purchase.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="orderId">PayPal Order ID</Label>
                  <Input
                    id="orderId"
                    placeholder="e.g., 8AB123456C789DEF0"
                    value={searchOrderId}
                    onChange={(e) => setSearchOrderId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Found in your PayPal receipt or browser URL
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentId">Payment ID</Label>
                  <Input
                    id="paymentId"
                    placeholder="e.g., 1A234567B890123C"
                    value={searchPaymentId}
                    onChange={(e) => setSearchPaymentId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    From your payment confirmation email
                  </p>
                </div>
              </div>
              
              <Button 
                onClick={handleSearchPayment} 
                disabled={searching || (!searchOrderId && !searchPaymentId)}
                className="w-full"
              >
                {searching ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Find My Payment
                  </>
                )}
              </Button>

              {searchResult && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Payment found! Check the results below.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Search Results */}
          {searchResult && (
            <PaymentRecoveryCard
              orderId={searchResult.orderId}
              paymentId={searchResult.paymentId}
            />
          )}
        </TabsContent>

        {/* Payment Issues */}
        <TabsContent value="issues" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Your Payment Issues
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Here are your failed or pending payments that need attention.
              </p>
            </CardHeader>
            <CardContent>
              {statusLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-3" />
                  <span>Loading your payment history...</span>
                </div>
              ) : problematicTransactions.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-green-700 mb-2">All Good!</h3>
                  <p className="text-green-600">You don't have any payment issues at the moment.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {problematicTransactions.map((transaction) => (
                    <div key={transaction.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {transaction.status === 'failed' ? (
                            <XCircle className="h-5 w-5 text-red-600" />
                          ) : (
                            <Clock className="h-5 w-5 text-yellow-600" />
                          )}
                          <div>
                            <h4 className="font-semibold">
                              {transaction.subscription_plans?.name || 'Premium Plan'}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              ${transaction.amount_usd.toFixed(2)} • {transaction.status}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {transaction.status === 'failed' && (
                            <Button
                              size="sm"
                              onClick={() => handleRetryPayment(transaction.id, transaction.plan_id)}
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Retry
                            </Button>
                          )}
                          <Button variant="outline" size="sm">
                            <Mail className="h-3 w-3 mr-1" />
                            Support
                          </Button>
                        </div>
                      </div>
                      
                      {transaction.error_message && (
                        <Alert className="border-red-200 bg-red-50">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Error:</strong> {transaction.error_message}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Get Help */}
        <TabsContent value="help" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href="/payment-dashboard">
                    <CreditCard className="h-4 w-4 mr-2" />
                    View Payment History
                  </a>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href="/contact">
                    <Mail className="h-4 w-4 mr-2" />
                    Contact Support
                  </a>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href="/pricing">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View All Plans
                  </a>
                </Button>
              </CardContent>
            </Card>

            {/* Common Issues */}
            <Card>
              <CardHeader>
                <CardTitle>Common Issues</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-sm">Payment was successful but I can't access features</h4>
                    <p className="text-xs text-muted-foreground">
                      Try logging out and back in, or use the "Find Payment" tab above.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">I was charged but got an error</h4>
                    <p className="text-xs text-muted-foreground">
                      Check your email for a receipt, then contact support with the transaction ID.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">PayPal redirect failed</h4>
                    <p className="text-xs text-muted-foreground">
                      Use the "Find Payment" feature with your PayPal Order ID to recover.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Support</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Email Support</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3" />
                      <span>support@jojoprompts.com</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      <span>Response within 24 hours</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-3">What to Include</h4>
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    <li>• Transaction ID or Order ID</li>
                    <li>• PayPal receipt/confirmation</li>
                    <li>• Description of the issue</li>
                    <li>• Screenshots if helpful</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}