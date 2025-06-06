
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { securityMonitor } from "@/utils/monitoring";
import { SecurityUtils } from "@/utils/security";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// Comprehensive list of Tap failure status codes and indicators
const TAP_FAILURE_STATUSES = [
  'DECLINED', 'FAILED', 'CANCELLED', 'ABANDONED', 'EXPIRED', 
  'REJECTED', 'VOIDED', 'ERROR', 'TIMEOUT'
];

const TAP_FAILURE_RESPONSE_CODES = [
  '101', '102', '103', '104', '105', '106', '107', '108', '109', '110',
  '201', '202', '203', '204', '205', '206', '207', '208', '209', '210',
  '301', '302', '303', '304', '305', '306', '307', '308', '309', '310',
  '401', '402', '403', '404', '405', '406', '407', '408', '409', '410',
  '501', '502', '503', '504', '505', '506', '507', '508', '509', '510'
];

export default function PaymentSuccessPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Redirect to home if not authenticated
    if (!user) {
      securityMonitor.logEvent('access_denied', {
        page: 'payment_success',
        reason: 'not_authenticated'
      });
      navigate('/');
      return;
    }

    const verifyPayment = async () => {
      try {
        const planId = searchParams.get('planId');
        const userId = searchParams.get('userId');
        const tapId = searchParams.get('tap_id');
        const chargeStatus = searchParams.get('status');
        const responseCode = searchParams.get('response_code');
        const chargeId = searchParams.get('charge_id');
        const paymentResult = searchParams.get('payment_result');
        
        console.log('Payment verification - All URL params:', { 
          planId, 
          userId, 
          tapId, 
          chargeStatus, 
          responseCode,
          chargeId,
          paymentResult,
          fullUrl: window.location.href,
          searchString: window.location.search
        });

        // Enhanced failure detection
        const isFailedStatus = chargeStatus && TAP_FAILURE_STATUSES.includes(chargeStatus.toUpperCase());
        const isFailedResponseCode = responseCode && TAP_FAILURE_RESPONSE_CODES.includes(responseCode);
        const isExplicitFailure = paymentResult === 'failed' || paymentResult === 'error';

        if (isFailedStatus) {
          console.log('Payment failed - Status indicates failure:', chargeStatus);
          const reason = `Payment ${chargeStatus.toLowerCase()}`;
          navigate(`/payment-failed?planId=${planId}&reason=${encodeURIComponent(reason)}`);
          return;
        }

        if (isFailedResponseCode) {
          console.log('Payment failed - Response code indicates failure:', responseCode);
          const reason = `Payment declined (Code: ${responseCode})`;
          navigate(`/payment-failed?planId=${planId}&reason=${encodeURIComponent(reason)}`);
          return;
        }

        if (isExplicitFailure) {
          console.log('Payment failed - Explicit failure result:', paymentResult);
          const reason = 'Payment was not completed successfully';
          navigate(`/payment-failed?planId=${planId}&reason=${encodeURIComponent(reason)}`);
          return;
        }

        // Check if we have the required payment parameters
        if (!planId || !userId) {
          console.error('Missing required payment parameters:', { planId, userId });
          setError('Missing payment information');
          setTimeout(() => {
            const reason = 'Missing payment information';
            navigate(`/payment-failed?planId=${planId || ''}&reason=${encodeURIComponent(reason)}`);
          }, 2000);
          return;
        }

        // Verify user ID matches authenticated user
        if (userId !== user.id) {
          console.error('User ID mismatch - URL user:', userId, 'Auth user:', user.id);
          setError('Invalid payment session');
          setTimeout(() => {
            const reason = 'Invalid payment session';
            navigate(`/payment-failed?planId=${planId}&reason=${encodeURIComponent(reason)}`);
          }, 2000);
          return;
        }

        // Get pending payment info from localStorage
        const pendingPaymentStr = localStorage.getItem('pending_payment');
        const pendingPayment = pendingPaymentStr ? JSON.parse(pendingPaymentStr) : null;

        // If we reach here, we assume success (no explicit failure indicators found)
        console.log('Proceeding with subscription creation - no failure indicators detected');

        const paymentData = {
          paymentId: tapId || chargeId || pendingPayment?.paymentId || `tap_${Date.now()}`,
          paymentMethod: 'tap',
          details: {
            id: tapId || chargeId || pendingPayment?.paymentId,
            status: chargeStatus || 'completed',
            amount: pendingPayment?.amount,
            response_code: responseCode,
            payment_result: paymentResult
          }
        };

        console.log('Creating subscription with payment data:', paymentData);

        const { data, error } = await supabase.functions.invoke("create-subscription", {
          body: {
            planId,
            userId,
            paymentData
          }
        });

        if (error) {
          console.error('Subscription creation error:', error);
          setError('Subscription setup failed');
          toast({
            title: "Subscription Error",
            description: "Payment was successful but subscription setup failed. Please contact support.",
            variant: "destructive",
          });
          setTimeout(() => {
            const reason = 'Subscription setup failed';
            navigate(`/payment-failed?planId=${planId}&reason=${encodeURIComponent(reason)}`);
          }, 2000);
          return;
        }

        if (!data || !data.success) {
          console.error('Subscription creation unsuccessful:', data);
          setError('Subscription activation failed');
          setTimeout(() => {
            const reason = 'Subscription activation failed';
            navigate(`/payment-failed?planId=${planId}&reason=${encodeURIComponent(reason)}`);
          }, 2000);
          return;
        }

        // Clear pending payment
        localStorage.removeItem('pending_payment');
        
        setVerified(true);
        setVerifying(false);

        toast({
          title: "Payment Successful!",
          description: "Your subscription has been activated successfully.",
        });

      } catch (error) {
        console.error('Payment verification error:', error);
        setError('Payment verification failed');
        setTimeout(() => {
          const planId = searchParams.get('planId');
          const reason = 'Payment verification failed';
          navigate(`/payment-failed?planId=${planId || ''}&reason=${encodeURIComponent(reason)}`);
        }, 2000);
      }
    };

    verifyPayment();
    
  }, [user, navigate, searchParams]);
  
  // Don't render anything while checking authentication
  if (!user) {
    return null;
  }

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-soft-bg">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Verifying your payment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-soft-bg">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Payment Processing Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">Redirecting to payment failed page...</p>
        </div>
      </div>
    );
  }

  if (!verified) {
    return null; // Will redirect to failed page
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
