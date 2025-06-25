
import { useState } from "react";
import { usePaymentSuccessParams } from "@/hooks/payment/usePaymentSuccessParams";
import { usePaymentSuccessVerification } from "@/hooks/payment/usePaymentSuccessVerification";
import { PaymentSuccessLoader } from "@/components/payment/PaymentSuccessLoader";
import { PaymentSuccessError } from "@/components/payment/PaymentSuccessError";
import { PaymentSuccessCard } from "@/components/payment/PaymentSuccessCard";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, LogIn, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { SessionManager } from "@/hooks/payment/helpers/sessionManager";
import { useAuth } from "@/contexts/AuthContext";
import { usePaymentEmails } from "@/hooks/usePaymentEmails";
import { useEffect } from "react";

export default function PaymentSuccessPage() {
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { sendPaymentConfirmation, sendInvoiceReceipt } = usePaymentEmails();

  const params = usePaymentSuccessParams();
  const authRequired = searchParams.get('auth_required') === 'true';

  // Enhanced session restoration attempt on load
  useEffect(() => {
    const attemptSessionRecovery = async () => {
      if (!user && !authLoading && SessionManager.hasBackup()) {
        console.log('Attempting session recovery on payment success page');
        const result = await SessionManager.restoreSession();
        if (result.success) {
          console.log('Session recovered successfully, refreshing page');
          window.location.reload();
        }
      }
    };

    attemptSessionRecovery();
  }, [user, authLoading]);

  // Send payment confirmation emails when payment is verified
  useEffect(() => {
    const sendPaymentEmails = async () => {
      if (verified && user && params.planId && params.paymentId) {
        try {
          // Get user name from metadata or email
          const userName = user.user_metadata?.first_name 
            ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
            : user.email.split('@')[0];

          // For demonstration, we'll use placeholder values
          // In a real implementation, you'd fetch this data from your subscription/plan tables
          const planName = "Premium Plan"; // This should come from your plan data
          const amount = 29.99; // This should come from the transaction data
          const paymentMethod = "PayPal"; // This should come from payment data
          const currentDate = new Date().toLocaleDateString();
          const invoiceNumber = `INV-${Date.now()}`;
          const billingPeriod = "1 Year";

          console.log('Sending payment confirmation and invoice emails...');

          // Send payment confirmation email
          await sendPaymentConfirmation(
            userName,
            user.email,
            planName,
            amount,
            params.paymentId
          );

          // Send invoice receipt email
          await sendInvoiceReceipt(
            userName,
            user.email,
            invoiceNumber,
            planName,
            amount,
            currentDate,
            paymentMethod,
            billingPeriod
          );

        } catch (error) {
          console.error('Error sending payment emails:', error);
          // Don't fail the success page if emails fail
        }
      }
    };

    sendPaymentEmails();
  }, [verified, user, params, sendPaymentConfirmation, sendInvoiceReceipt]);

  usePaymentSuccessVerification({
    params,
    setVerifying,
    setVerified,
    setError,
  });

  // Enhanced auth required case
  if (authRequired && !verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-soft-bg py-16">
        <div className="container mx-auto max-w-md px-4">
          <Card className="border-2 border-green-200 shadow-xl bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden">
            <CardHeader className="text-center pb-4 bg-gradient-to-r from-green-50 to-green-100/50">
              <div className="flex justify-center mb-4">
                <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
              </div>
              <CardTitle className="text-2xl font-bold text-green-800">Payment Successful!</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-6 p-6">
              <div className="space-y-3">
                <p className="text-lg text-green-700 font-medium">
                  Your payment has been processed successfully!
                </p>
                <p className="text-muted-foreground">
                  To access your premium features, please log in to your account.
                </p>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <LogIn className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <div className="text-left">
                    <p className="font-medium text-green-800 text-sm mb-1">Next Step:</p>
                    <p className="text-sm text-green-700">
                      Click the button below to log in and start using your premium subscription.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Button asChild className="w-full bg-green-600 hover:bg-green-700">
                  <Link to="/login">
                    <LogIn className="h-4 w-4 mr-2" />
                    Log In to Access Premium
                  </Link>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                
                <Button variant="ghost" asChild className="w-full">
                  <Link to="/contact">Contact Support</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (verifying) {
    return <PaymentSuccessLoader />;
  }

  if (error) {
    // Enhanced error handling with session recovery suggestion
    if (error.toLowerCase().includes("login") || error.toLowerCase().includes("authentication") || !user) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-soft-bg py-16">
          <div className="container mx-auto max-w-md px-4">
            <PaymentSuccessError error={error} />
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700 mb-3">
                If your payment was successful but you were logged out, try these options:
              </p>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Page
                </Button>
                <Button asChild size="sm" className="w-full">
                  <Link to="/login">
                    <LogIn className="h-4 w-4 mr-2" />
                    Log In Again
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" asChild className="w-full">
                  <Link to="/prompts">Go to Prompts</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return <PaymentSuccessError error={error} />;
  }

  if (!verified) {
    return <PaymentSuccessLoader />;
  }

  return <PaymentSuccessCard />;
}
