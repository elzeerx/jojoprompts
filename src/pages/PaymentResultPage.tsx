
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function PaymentResultPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    const verifyPaymentAndRedirect = async () => {
      try {
        // Extract parameters from URL - enhanced logging
        const planId = searchParams.get('planId');
        const userId = searchParams.get('userId');
        const tapId = searchParams.get('tap_id');
        const chargeId = searchParams.get('charge_id');
        const responseCode = searchParams.get('response_code');
        
        // Log all available URL parameters for debugging
        const allParams = Object.fromEntries(searchParams.entries());
        console.log('PaymentResultPage: ALL URL parameters received:', allParams);
        
        console.log('PaymentResultPage: Starting verification with params:', { 
          planId, 
          userId, 
          tapId, 
          chargeId,
          responseCode,
          fullUrl: window.location.href,
          searchString: window.location.search
        });

        // Check for required parameters
        if (!planId || !userId) {
          console.error('PaymentResultPage: Missing required parameters planId or userId');
          navigate(`/payment-failed?planId=${planId || ''}&reason=${encodeURIComponent('Missing payment information')}`);
          return;
        }

        // Enhanced charge ID detection with fallback logic
        let verifyChargeId = tapId || chargeId;
        
        // Fallback: try to extract charge ID from other possible parameter names
        if (!verifyChargeId) {
          verifyChargeId = searchParams.get('id') || 
                          searchParams.get('charge') || 
                          searchParams.get('payment_id') ||
                          searchParams.get('transaction_id');
          console.log('PaymentResultPage: Using fallback charge ID extraction:', verifyChargeId);
        }
        
        if (!verifyChargeId) {
          console.error('PaymentResultPage: No payment ID found for verification. Available params:', allParams);
          navigate(`/payment-failed?planId=${planId}&reason=${encodeURIComponent('No payment ID provided')}`);
          return;
        }

        console.log('PaymentResultPage: Verifying payment with Tap API, charge ID:', verifyChargeId);

        // Verify payment with Tap API
        const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-tap-payment', {
          body: { chargeId: verifyChargeId }
        });

        if (verifyError) {
          console.error('PaymentResultPage: Payment verification failed:', verifyError);
          navigate(`/payment-failed?planId=${planId}&reason=${encodeURIComponent('Payment verification failed: ' + verifyError.message)}`);
          return;
        }

        if (!verifyData) {
          console.error('PaymentResultPage: No verification data received');
          navigate(`/payment-failed?planId=${planId}&reason=${encodeURIComponent('Payment verification returned no data')}`);
          return;
        }

        console.log('PaymentResultPage: Tap verification result:', verifyData);

        // Check payment status - only these are considered successful
        const verifiedStatus = verifyData.status;
        const successStatuses = ['CAPTURED', 'PAID', 'AUTHORIZED'];
        
        if (!verifiedStatus || !successStatuses.includes(verifiedStatus.toUpperCase())) {
          console.log('PaymentResultPage: Payment not successful, verified status:', verifiedStatus);
          navigate(`/payment-failed?planId=${planId}&reason=${encodeURIComponent(`Payment was ${verifiedStatus || 'not completed'}`)}&tap_id=${verifyChargeId}&status=${verifiedStatus || 'unknown'}&response_code=${responseCode || ''}`);
          return;
        }

        console.log('PaymentResultPage: Payment verified as successful, redirecting to success page');
        
        // Payment was successful - redirect to success page with verification data
        navigate(`/payment-success?planId=${planId}&userId=${userId}&tap_id=${verifyChargeId}&status=${verifiedStatus}&response_code=${responseCode || ''}&amount=${verifyData.amount || ''}`);

      } catch (error: any) {
        console.error('PaymentResultPage: Verification error:', error);
        const planId = searchParams.get('planId');
        navigate(`/payment-failed?planId=${planId || ''}&reason=${encodeURIComponent('Payment verification failed: ' + error.message)}`);
      } finally {
        setVerifying(false);
      }
    };

    verifyPaymentAndRedirect();
  }, [navigate, searchParams]);

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-soft-bg">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium">Verifying your payment...</p>
          <p className="text-sm text-gray-500 mt-2">Please wait while we confirm your payment with the bank...</p>
        </div>
      </div>
    );
  }

  // This should not be reached as we always redirect
  return (
    <div className="min-h-screen flex items-center justify-center bg-soft-bg">
      <div className="text-center">
        <p>Processing payment result...</p>
      </div>
    </div>
  );
}
