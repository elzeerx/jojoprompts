
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function PaymentSuccessPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    console.log('PaymentSuccessPage accessed', {
      hasUser: !!user,
      userId: user?.id,
      searchParams: window.location.search,
      fullUrl: window.location.href
    });

    const verifyPayment = async () => {
      try {
        // Extract parameters from URL
        const planId = searchParams.get('planId');
        const userId = searchParams.get('userId');
        const tapId = searchParams.get('tap_id');
        const chargeStatus = searchParams.get('status');
        const responseCode = searchParams.get('response_code');
        const chargeId = searchParams.get('charge_id');
        
        console.log('Payment verification - Starting with params:', { 
          planId, 
          userId, 
          tapId, 
          chargeStatus, 
          responseCode,
          chargeId,
          fullUrl: window.location.href
        });

        // CRITICAL: Assume failure unless explicitly proven successful
        let paymentVerified = false;
        let verifiedPaymentData = null;

        // Check for required parameters
        if (!planId || !userId) {
          console.error('Missing required payment parameters:', { planId, userId });
          throw new Error('Missing payment information');
        }

        // Verify user ID matches authenticated user (if user is logged in)
        if (user && userId !== user.id) {
          console.error('User ID mismatch - URL user:', userId, 'Auth user:', user.id);
          throw new Error('Invalid payment session');
        }

        // Get the payment ID for verification
        const verifyChargeId = tapId || chargeId;
        
        if (!verifyChargeId) {
          console.error('No payment ID found for verification');
          throw new Error('No payment ID provided');
        }

        console.log('Verifying payment with Tap API, charge ID:', verifyChargeId);

        // MANDATORY payment verification with Tap API
        const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-tap-payment', {
          body: { chargeId: verifyChargeId }
        });

        if (verifyError) {
          console.error('Payment verification failed:', verifyError);
          throw new Error('Payment verification failed');
        }

        if (!verifyData) {
          console.error('No verification data received');
          throw new Error('Payment verification returned no data');
        }

        console.log('Tap verification result:', verifyData);

        // Check if payment was actually successful
        const verifiedStatus = verifyData.status;
        const successStatuses = ['CAPTURED', 'PAID', 'AUTHORIZED'];
        
        if (!verifiedStatus || !successStatuses.includes(verifiedStatus.toUpperCase())) {
          console.log('Payment not successful, verified status:', verifiedStatus);
          throw new Error(`Payment was ${verifiedStatus || 'not completed'}`);
        }

        // Additional verification: check amount matches if available
        if (verifyData.amount) {
          const pendingPaymentStr = localStorage.getItem('pending_payment');
          const pendingPayment = pendingPaymentStr ? JSON.parse(pendingPaymentStr) : null;
          
          if (pendingPayment?.amount && Math.abs(verifyData.amount - pendingPayment.amount) > 0.01) {
            console.error('Payment amount mismatch:', { 
              verified: verifyData.amount, 
              expected: pendingPayment.amount 
            });
            throw new Error('Payment amount verification failed');
          }
        }

        // Only now mark as verified
        paymentVerified = true;
        verifiedPaymentData = verifyData;

        console.log('Payment successfully verified, proceeding with subscription creation');

        // Prepare payment data for subscription creation
        const paymentData = {
          paymentId: verifyChargeId,
          paymentMethod: 'tap',
          details: {
            id: verifyChargeId,
            status: verifiedStatus,
            amount: verifiedPaymentData.amount,
            response_code: responseCode,
            verified_at: new Date().toISOString()
          }
        };

        console.log('Creating subscription with verified payment data:', paymentData);

        const { data, error } = await supabase.functions.invoke("create-subscription", {
          body: {
            planId,
            userId,
            paymentData
          }
        });

        if (error) {
          console.error('Subscription creation error:', error);
          throw new Error('Subscription setup failed after verified payment');
        }

        if (!data || !data.success) {
          console.error('Subscription creation unsuccessful:', data);
          throw new Error('Subscription activation failed after verified payment');
        }

        // Success! Clear pending payment and update state
        localStorage.removeItem('pending_payment');
        setVerified(true);
        setVerifying(false);

        console.log('Payment and subscription creation completed successfully');

        toast({
          title: "Payment Successful!",
          description: "Your subscription has been activated successfully.",
        });

      } catch (error: any) {
        console.error('Payment verification/processing error:', error);
        
        // Always redirect to failure page on any error
        const planId = searchParams.get('planId');
        const errorMessage = error.message || 'Payment verification failed';
        
        console.log('Redirecting to failure page due to error:', errorMessage);
        
        // Small delay to ensure logging is captured
        setTimeout(() => {
          navigate(`/payment-failed?planId=${planId || ''}&reason=${encodeURIComponent(errorMessage)}`);
        }, 1000);
        
        setError(errorMessage);
        setVerifying(false);
      }
    };

    verifyPayment();
    
  }, [user, navigate, searchParams]);

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-soft-bg">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Verifying your payment...</p>
          <p className="text-sm text-gray-500 mt-2">Please wait while we confirm your payment with the bank...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-soft-bg">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Payment Verification Failed</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500 mb-4">Redirecting to payment status page...</p>
          <div className="space-y-2">
            <Button className="w-full" asChild>
              <Link to="/pricing">Back to Pricing</Link>
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <Link to="/contact">Contact Support</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!verified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-soft-bg">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Payment Not Verified</h2>
          <p className="text-gray-600 mb-4">We couldn't verify your payment status.</p>
          <div className="space-y-2">
            <Button className="w-full" asChild>
              <Link to="/pricing">Back to Pricing</Link>
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <Link to="/contact">Contact Support</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="mobile-container-padding mobile-section-padding relative">
      {/* Enhanced mobile background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 right-10 text-warm-gold/20 animate-pulse">
          <Sparkles className="h-8 w-8" />
        </div>
        <div className="absolute bottom-10 left-10 text-muted-teal/20 animate-pulse delay-1000">
          <Sparkles className="h-6 w-6" />
        </div>
      </div>

      <div className="max-w-lg mx-auto relative z-10">
        <Card className="border-2 border-green-200 shadow-xl bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden">
          <CardHeader className="text-center pb-4 bg-gradient-to-r from-green-50 to-warm-gold/5">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <CheckCircle className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-green-500" />
                <div className="absolute -top-1 -right-1 text-warm-gold animate-bounce">
                  <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
              </div>
            </div>
            <CardTitle className="text-xl sm:text-2xl font-bold text-dark-base">Payment Successful!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4 sm:space-y-6 p-6">
            <p className="text-base sm:text-lg text-muted-foreground">
              Thank you for your purchase. Your plan access is now active.
            </p>
            
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 sm:p-6">
              <p className="font-medium text-green-800 text-sm sm:text-base">Your account has been successfully upgraded!</p>
              <p className="text-xs sm:text-sm mt-2 text-green-700">You now have access to all the features included in your plan.</p>
            </div>
            
            <div className="border-t pt-4 sm:pt-6">
              <p className="text-sm sm:text-base text-muted-foreground">
                We've sent you a confirmation email with your receipt and access details.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-3 p-6 pt-0">
            <Button className="w-full mobile-button-primary" asChild>
              <Link to="/prompts">Browse Prompts</Link>
            </Button>
            <Button variant="outline" className="w-full mobile-button-secondary" asChild>
              <Link to="/dashboard">View My Account</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
