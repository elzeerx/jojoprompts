
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, AlertTriangle } from "lucide-react";

export default function PaymentCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<string>('checking');
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const MAX_POLLS = 20; // Reduced to 40 seconds max

  useEffect(() => {
    // Log all available parameters for debugging
    const allParams = {};
    searchParams.forEach((value, key) => {
      allParams[key] = value;
    });
    console.log('Payment callback - All URL parameters:', allParams);
    console.log('Payment callback - Full URL:', window.location.href);

    // Try to get payment identifier from various possible parameter names
    const tapId = searchParams.get('tap_id') || 
                  searchParams.get('id') || 
                  searchParams.get('charge_id') || 
                  searchParams.get('chg_id');
    
    const reference = searchParams.get('reference') || 
                     searchParams.get('tap_reference') || 
                     searchParams.get('ref');
    
    console.log('Payment callback extracted parameters:', { 
      tapId, 
      reference,
      originalParams: allParams 
    });

    if (!tapId && !reference) {
      console.error('No payment identifier found in URL parameters');
      setError('Missing payment information in callback URL');
      setTimeout(() => {
        const planId = searchParams.get('planId') || searchParams.get('plan_id');
        navigate(`/payment-failed?planId=${planId || ''}&reason=Missing payment reference`);
      }, 3000);
      return;
    }

    const poll = async (currentPollCount: number = 0) => {
      if (currentPollCount >= MAX_POLLS) {
        console.log('Maximum polling attempts reached');
        setError('Payment verification timeout');
        setTimeout(() => {
          const planId = searchParams.get('planId') || searchParams.get('plan_id');
          navigate(`/payment-failed?planId=${planId || ''}&reason=Payment verification timeout`);
        }, 3000);
        return;
      }

      try {
        // Build query parameters for the verify-tap function
        const params = new URLSearchParams();
        if (reference) params.append('reference', reference);
        if (tapId) params.append('tap_id', tapId);
        
        console.log(`Polling attempt ${currentPollCount + 1}/${MAX_POLLS} - Calling verify-tap with params:`, params.toString());

        // Use direct HTTP GET request to the verify-tap function
        const SUPABASE_URL = "https://fxkqgjakbyrxkmevkglv.supabase.co";
        const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4a3FnamFrYnlyeGttZXZrZ2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ4ODY4NjksImV4cCI6MjA2MDQ2Mjg2OX0.u4O7nvVrW6HZjZj058T9kKpEfa5BsyWT0i_p4UxcZi4";
        
        const apiUrl = `${SUPABASE_URL}/functions/v1/verify-tap?${params.toString()}`;
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Verify-tap API call failed:', { 
            status: response.status, 
            statusText: response.statusText,
            error: errorText 
          });
          throw new Error(`API call failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('Verify-tap response:', result, 'Poll count:', currentPollCount + 1);
        
        handlePaymentStatus(result.status, currentPollCount);

      } catch (error: any) {
        console.error('Payment verification error:', error);
        setError(error.message);
        setTimeout(() => {
          const planId = searchParams.get('planId') || searchParams.get('plan_id');
          navigate(`/payment-failed?planId=${planId || ''}&reason=Payment verification failed: ${error.message}`);
        }, 3000);
      }
    };

    const handlePaymentStatus = (paymentStatus: string, currentPollCount: number) => {
      console.log('Processing payment status:', paymentStatus, 'Poll count:', currentPollCount + 1);
      setStatus(paymentStatus);
      setPollCount(currentPollCount + 1);

      if (paymentStatus === 'CAPTURED') {
        // Payment successful
        console.log('Payment captured successfully, redirecting to success page');
        const planId = searchParams.get('planId') || searchParams.get('plan_id');
        const userId = searchParams.get('userId') || searchParams.get('user_id');
        
        const successParams = new URLSearchParams();
        if (planId) successParams.append('planId', planId);
        if (userId) successParams.append('userId', userId);
        if (tapId) successParams.append('tap_id', tapId);
        if (reference) successParams.append('reference', reference);
        
        navigate(`/payment-success?${successParams.toString()}`);
      } else if (['FAILED', 'DECLINED', 'CANCELLED', 'VOIDED', 'ERROR'].includes(paymentStatus)) {
        // Payment failed
        console.log('Payment failed with status:', paymentStatus);
        const planId = searchParams.get('planId') || searchParams.get('plan_id');
        const failedParams = new URLSearchParams();
        if (planId) failedParams.append('planId', planId);
        failedParams.append('reason', `Payment ${paymentStatus.toLowerCase()}`);
        failedParams.append('status', paymentStatus);
        if (tapId) failedParams.append('tap_id', tapId);
        
        navigate(`/payment-failed?${failedParams.toString()}`);
      } else {
        // Continue polling for pending statuses
        const delay = Math.min(2000 + (currentPollCount * 200), 4000); // 2s to 4s delay
        console.log(`Payment status: ${paymentStatus}, polling again in ${delay}ms...`);
        setTimeout(() => poll(currentPollCount + 1), delay);
      }
    };

    // Start polling immediately
    poll(0);
  }, [navigate, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-soft-bg">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Payment Verification Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">Redirecting to payment failed page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-soft-bg">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
        <h2 className="text-xl font-semibold mb-2">Processing Your Payment</h2>
        <p className="text-gray-600 mb-4">
          Please wait while we verify your payment with Tap...
        </p>
        <div className="text-sm text-gray-500">
          <p>Status: {status === 'checking' ? 'Checking payment status' : status}</p>
          <p className="mt-2">Verification attempt {pollCount} of {MAX_POLLS}</p>
          <p className="mt-1">This may take a few moments</p>
        </div>
      </div>
    </div>
  );
}
