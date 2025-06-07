
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
        // Extract tap_id from URL parameters - Tap appends this automatically
        const tapId = searchParams.get('tap_id');
        
        console.log('PaymentResultPage: Processing payment result with tap_id:', tapId);
        console.log('PaymentResultPage: Full URL:', window.location.href);

        if (!tapId) {
          console.error('PaymentResultPage: No tap_id found in URL');
          navigate('/payment/failed?reason=' + encodeURIComponent('No payment ID found'));
          return;
        }

        console.log('PaymentResultPage: Verifying payment with tap_id:', tapId);

        // Verify payment with our edge function
        const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-tap-payment', {
          body: { tap_id: tapId }
        });

        if (verifyError) {
          console.error('PaymentResultPage: Payment verification failed:', verifyError);
          navigate('/payment/failed?reason=' + encodeURIComponent('Payment verification failed: ' + verifyError.message));
          return;
        }

        if (!verifyData) {
          console.error('PaymentResultPage: No verification data received');
          navigate('/payment/failed?reason=' + encodeURIComponent('Payment verification returned no data'));
          return;
        }

        console.log('PaymentResultPage: Verification result:', verifyData);

        // Check if verification was successful
        if (!verifyData.success) {
          console.log('PaymentResultPage: Payment verification unsuccessful:', verifyData.error);
          navigate('/payment/failed?reason=' + encodeURIComponent(verifyData.error || 'Payment verification failed'));
          return;
        }

        console.log('PaymentResultPage: Payment verified successfully, redirecting to success page');
        
        // Payment was successful - redirect to success page
        navigate(`/payment/success?planId=${verifyData.plan_id}&userId=${verifyData.user_id}&tap_id=${tapId}`);

      } catch (error: any) {
        console.error('PaymentResultPage: Verification error:', error);
        navigate('/payment/failed?reason=' + encodeURIComponent('Payment verification failed: ' + error.message));
      } finally {
        setVerifying(false);
      }
    };

    verifyPaymentAndRedirect();
  }, [navigate, searchParams]);

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium">Verifying your payment...</p>
          <p className="text-sm text-gray-500 mt-2">Please wait while we confirm your payment...</p>
        </div>
      </div>
    );
  }

  // This should not be reached as we always redirect
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p>Processing payment result...</p>
      </div>
    </div>
  );
}
