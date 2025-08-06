import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, LogIn, RefreshCw, User, CreditCard, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePaymentRecovery } from '@/hooks/payment/usePaymentRecovery';

interface PaymentRecoveryCardProps {
  orderId?: string;
  paymentId?: string;
  planId?: string;
  userId?: string;
}

export function PaymentRecoveryCard({ orderId, paymentId, planId, userId }: PaymentRecoveryCardProps) {
  const [attemptingAutoLogin, setAttemptingAutoLogin] = useState(false);
  const { loading, recoveryResult, error, attemptAutoLogin } = usePaymentRecovery({
    orderId, paymentId, planId, userId
  });

  const handleAutoLoginAttempt = async () => {
    if (!recoveryResult?.userEmail) return;
    
    setAttemptingAutoLogin(true);
    try {
      const success = await attemptAutoLogin(recoveryResult.userEmail);
      if (success) {
        // Session restored, reload page to update auth state
        window.location.reload();
      }
    } finally {
      setAttemptingAutoLogin(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-soft-bg py-16">
        <div className="container mx-auto max-w-md px-4">
          <Card className="shadow-xl bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden">
            <CardContent className="text-center p-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-lg font-medium">Checking your payment status...</p>
              <p className="text-sm text-muted-foreground mt-2">
                We're looking for your completed payment to restore your account access.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !recoveryResult?.canRecover) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-soft-bg py-16">
        <div className="container mx-auto max-w-md px-4">
          <Card className="shadow-xl bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden">
            <CardHeader className="text-center pb-4">
              <LogIn className="mx-auto h-12 w-12 text-blue-600 mb-4" />
              <CardTitle className="text-xl font-bold">Login Required</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4 p-6">
              <p className="text-muted-foreground">
                {error || "We couldn't find your payment information. Please log in to access your account."}
              </p>
              
              <div className="space-y-3">
                <Button asChild className="w-full">
                  <Link to="/login">
                    <LogIn className="h-4 w-4 mr-2" />
                    Log In to Your Account
                  </Link>
                </Button>
                
                <Button variant="outline" asChild className="w-full">
                  <Link to="/contact">Contact Support</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-soft-bg py-16">
      <div className="container mx-auto max-w-lg px-4">
        <Card className="border-2 border-green-200 shadow-xl bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden">
          <CardHeader className="text-center pb-4 bg-gradient-to-r from-green-50 to-green-100/50">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-2xl font-bold text-green-800">Payment Successful!</CardTitle>
            <p className="text-green-700 mt-2">
              We found your completed payment and can restore your access.
            </p>
          </CardHeader>
          
          <CardContent className="space-y-6 p-6">
            {/* Payment Details */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Payment Details
              </h3>
              <div className="space-y-2 text-sm">
                {recoveryResult.planName && (
                  <div className="flex justify-between">
                    <span className="text-green-700">Plan:</span>
                    <span className="font-medium text-green-800">{recoveryResult.planName}</span>
                  </div>
                )}
                {recoveryResult.amount && (
                  <div className="flex justify-between">
                    <span className="text-green-700">Amount:</span>
                    <span className="font-medium text-green-800">${recoveryResult.amount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-green-700">Status:</span>
                  <span className="font-medium text-green-800">
                    {recoveryResult.subscriptionActive ? 'Active' : 'Completed'}
                  </span>
                </div>
              </div>
            </div>

            {/* Account Information */}
            {recoveryResult.userEmail && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Account Information
                </h3>
                <div className="text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-700">Email:</span>
                    <span className="font-medium text-blue-800">{recoveryResult.userEmail}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              {recoveryResult.userEmail && (
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={handleAutoLoginAttempt}
                  disabled={attemptingAutoLogin}
                >
                  {attemptingAutoLogin ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Restoring Access...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Access Your Premium Features
                    </>
                  )}
                </Button>
              )}
              
              <Button asChild variant="outline" className="w-full">
                <Link to="/login">
                  <LogIn className="h-4 w-4 mr-2" />
                  Manual Login
                </Link>
              </Button>
              
              <Button variant="ghost" asChild className="w-full">
                <Link to="/prompts">Browse Prompts</Link>
              </Button>
            </div>

            {/* Help Text */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-600 text-center">
                Having trouble? Contact our support team with transaction ID: 
                <span className="font-mono font-semibold ml-1">
                  {recoveryResult.transactionId?.substring(0, 8)}...
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}