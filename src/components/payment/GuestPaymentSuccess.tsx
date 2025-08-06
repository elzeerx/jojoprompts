import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, LogIn, Mail, ArrowRight, Gift } from 'lucide-react';
import { Link } from 'react-router-dom';

interface GuestPaymentSuccessProps {
  planName?: string;
  amount?: number;
  transactionId?: string;
  userEmail?: string;
}

export function GuestPaymentSuccess({ 
  planName, 
  amount, 
  transactionId, 
  userEmail 
}: GuestPaymentSuccessProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-soft-bg py-16">
      <div className="container mx-auto max-w-lg px-4">
        <Card className="border-2 border-green-200 shadow-xl bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden">
          <CardHeader className="text-center pb-4 bg-gradient-to-r from-green-50 to-green-100/50">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-2xl font-bold text-green-800">Payment Complete!</CardTitle>
            <p className="text-green-700 mt-2">
              Your premium subscription is ready to use.
            </p>
          </CardHeader>
          
          <CardContent className="space-y-6 p-6">
            {/* Success Message */}
            <div className="text-center space-y-3">
              <h3 className="text-lg font-semibold text-gray-900">
                🎉 Welcome to Premium!
              </h3>
              <p className="text-gray-600">
                Your payment has been processed successfully and your premium features are now active.
              </p>
            </div>

            {/* Payment Details */}
            {(planName || amount) && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <h4 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <Gift className="h-4 w-4" />
                  Purchase Details
                </h4>
                <div className="space-y-2 text-sm">
                  {planName && (
                    <div className="flex justify-between">
                      <span className="text-green-700">Plan:</span>
                      <span className="font-medium text-green-800">{planName}</span>
                    </div>
                  )}
                  {amount && (
                    <div className="flex justify-between">
                      <span className="text-green-700">Amount:</span>
                      <span className="font-medium text-green-800">${amount.toFixed(2)}</span>
                    </div>
                  )}
                  {transactionId && (
                    <div className="flex justify-between">
                      <span className="text-green-700">Transaction:</span>
                      <span className="font-mono text-xs text-green-800">
                        {transactionId.substring(0, 8)}...
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Email Confirmation */}
            {userEmail && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-blue-800 mb-1">Confirmation Email Sent</h4>
                    <p className="text-sm text-blue-700">
                      We've sent a confirmation email to <span className="font-medium">{userEmail}</span> with your receipt and account details.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Next Steps */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <h4 className="font-semibold text-gray-800 mb-3">What's Next?</h4>
              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  Log in to access your premium features
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  Browse our exclusive premium prompt library
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  Use advanced search and filtering tools
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button asChild className="w-full bg-green-600 hover:bg-green-700">
                <Link to="/login">
                  <LogIn className="h-4 w-4 mr-2" />
                  Log In to Access Premium
                </Link>
              </Button>
              
              <Button asChild variant="outline" className="w-full">
                <Link to="/prompts">
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Browse Premium Prompts
                </Link>
              </Button>
              
              <Button variant="ghost" asChild className="w-full">
                <Link to="/contact">Need Help? Contact Support</Link>
              </Button>
            </div>

            {/* Security Note */}
            <div className="text-center">
              <p className="text-xs text-gray-500">
                🔒 Your payment was processed securely. Keep this page as your receipt.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}