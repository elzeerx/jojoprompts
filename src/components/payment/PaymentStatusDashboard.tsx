import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCw, 
  CreditCard, 
  Calendar,
  AlertTriangle,
  ExternalLink,
  Download
} from 'lucide-react';
import { format } from 'date-fns';
import { usePaymentStatus } from '@/hooks/payment/usePaymentStatus';
import { toast } from '@/hooks/use-toast';

const getStatusIcon = (status: string) => {
  switch (status.toLowerCase()) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'failed':
    case 'cancelled':
      return <XCircle className="h-4 w-4 text-red-600" />;
    case 'pending':
    case 'processing':
      return <Clock className="h-4 w-4 text-yellow-600" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-gray-600" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'active':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'failed':
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'pending':
    case 'processing':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export function PaymentStatusDashboard() {
  const { 
    transactions, 
    subscriptions, 
    loading, 
    error, 
    refetch, 
    retryFailedPayment,
    cancelSubscription 
  } = usePaymentStatus();

  const handleRetryPayment = async (transactionId: string, planId: string) => {
    const result = await retryFailedPayment(transactionId, planId);
    
    if (result.success && result.redirectUrl) {
      window.location.href = result.redirectUrl;
    } else {
      toast({
        title: "Retry Failed",
        description: result.error || "Could not retry payment. Please contact support.",
        variant: "destructive"
      });
    }
  };

  const handleCancelSubscription = async (subscriptionId: string) => {
    if (!confirm('Are you sure you want to cancel your subscription? This action cannot be undone.')) {
      return;
    }

    const result = await cancelSubscription(subscriptionId);
    
    if (result.success) {
      toast({
        title: "Subscription Cancelled",
        description: "Your subscription has been cancelled successfully.",
      });
    } else {
      toast({
        title: "Cancellation Failed",
        description: result.error || "Could not cancel subscription. Please contact support.",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-3 text-lg">Loading your payment information...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card className="border-red-200">
          <CardContent className="p-6 text-center">
            <XCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-800 mb-2">Failed to Load Payment Data</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={refetch} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payment Dashboard</h1>
          <p className="text-muted-foreground">Manage your subscriptions and payment history</p>
        </div>
        <Button onClick={refetch} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Active Subscriptions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Active Subscriptions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subscriptions.filter(sub => sub.status === 'active').length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No Active Subscriptions</h3>
              <p className="text-gray-500 mb-4">You don't have any active subscriptions at the moment.</p>
              <Button asChild>
                <a href="/pricing">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Plans
                </a>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {subscriptions
                .filter(sub => sub.status === 'active')
                .map((subscription) => (
                  <div key={subscription.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-semibold">{subscription.subscription_plans?.name || 'Premium Plan'}</h4>
                        <p className="text-sm text-muted-foreground">
                          Started {format(new Date(subscription.start_date), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={getStatusColor(subscription.status)}>
                          {getStatusIcon(subscription.status)}
                          <span className="ml-1 capitalize">{subscription.status}</span>
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelSubscription(subscription.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {subscription.subscription_plans?.is_lifetime 
                          ? 'Lifetime Access' 
                          : subscription.end_date 
                            ? `Expires ${format(new Date(subscription.end_date), 'MMM dd, yyyy')}`
                            : 'No expiration'
                        }
                      </span>
                      <span>Payment: {subscription.payment_method}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Payment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No Payment History</h3>
              <p className="text-gray-500">Your payment transactions will appear here once you make a purchase.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(transaction.status)}
                      <div>
                        <h4 className="font-semibold">
                          {transaction.subscription_plans?.name || 'Premium Plan'}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(transaction.created_at), 'MMM dd, yyyy \'at\' HH:mm')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">${transaction.amount_usd.toFixed(2)}</span>
                      <Badge className={getStatusColor(transaction.status)}>
                        <span className="capitalize">{transaction.status}</span>
                      </Badge>
                    </div>
                  </div>

                  {/* Error Message */}
                  {transaction.error_message && (
                    <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                      <strong>Error:</strong> {transaction.error_message}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    {transaction.status === 'failed' && (
                      <Button
                        size="sm"
                        onClick={() => handleRetryPayment(transaction.id, transaction.plan_id)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Retry Payment
                      </Button>
                    )}
                    
                    {transaction.paypal_payment_id && (
                      <Button variant="outline" size="sm">
                        <Download className="h-3 w-3 mr-1" />
                        Receipt
                      </Button>
                    )}

                    <span className="text-xs text-muted-foreground ml-auto">
                      ID: {transaction.id.substring(0, 8)}...
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button variant="outline" asChild>
              <a href="/contact">
                <ExternalLink className="h-4 w-4 mr-2" />
                Contact Support
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/pricing">
                <ExternalLink className="h-4 w-4 mr-2" />
                View All Plans
              </a>
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Having payment issues? Our support team can help with refunds, billing questions, and subscription management.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}