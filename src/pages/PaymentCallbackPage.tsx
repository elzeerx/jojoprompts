
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function PaymentCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<string>('checking');
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const MAX_POLLS = 30; // Maximum 60 seconds of polling

  useEffect(() => {
    const tapId = searchParams.get('tap_id');
    const tapReference = searchParams.get('tap_reference');
    const reference = searchParams.get('reference');
    
    // Get reference parameter (could be tap_reference or reference)
    const ref = tapReference || reference;
    
    console.log('Payment callback parameters:', { tapId, tapReference, reference, ref });

    if (!ref && !tapId) {
      setError('Missing payment reference parameters');
      setTimeout(() => navigate('/payment-failed?reason=Missing payment reference'), 3000);
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
        if (ref) params.append('reference', ref);
        if (tapId) params.append('tap_id', tapId);
        
        console.log(`Polling attempt ${currentPollCount + 1}/${MAX_POLLS} - Calling verify-tap function with params:`, params.toString());

        // Call the verify-tap edge function using URL parameters only
        const functionUrl = `verify-tap?${params.toString()}`;
        const { data, error } = await supabase.functions.invoke(functionUrl);

        console.log('Function response:', { data, error, attempt: currentPollCount + 1 });

        if (error || !data) {
          console.log('Function invoke failed, trying direct fetch as fallback:', error);
          
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
            console.error('Direct API call failed:', errorText);
            throw new Error(`API call failed: ${response.status}`);
          }

          const result = await response.json();
          handlePaymentStatus(result.status, currentPollCount);
        } else {
          handlePaymentStatus(data.status, currentPollCount);
        }
      } catch (error: any) {
        console.error('Payment verification error:', error);
        setError(error.message);
        setTimeout(() => {
          const planId = searchParams.get('planId') || searchParams.get('plan_id');
          navigate(`/payment-failed?planId=${planId || ''}&reason=Payment verification failed`);
        }, 3000);
      }
    };

    const handlePaymentStatus = (paymentStatus: string, currentPollCount: number) => {
      console.log('Processing payment status:', paymentStatus, 'Poll count:', currentPollCount + 1);
      setStatus(paymentStatus);
      setPollCount(currentPollCount + 1);

      if (paymentStatus === 'CAPTURED') {
        // Payment successful
        const planId = searchParams.get('planId') || searchParams.get('plan_id');
        const userId = searchParams.get('userId') || searchParams.get('user_id');
        
        const successParams = new URLSearchParams();
        if (planId) successParams.append('planId', planId);
        if (userId) successParams.append('userId', userId);
        if (tapId) successParams.append('tap_id', tapId);
        if (ref) successParams.append('reference', ref);
        
        navigate(`/payment-success?${successParams.toString()}`);
      } else if (['FAILED', 'DECLINED', 'CANCELLED', 'VOIDED', 'ERROR'].includes(paymentStatus)) {
        // Payment failed
        const planId = searchParams.get('planId') || searchParams.get('plan_id');
        const failedParams = new URLSearchParams();
        if (planId) failedParams.append('planId', planId);
        failedParams.append('reason', `Payment ${paymentStatus.toLowerCase()}`);
        if (tapId) failedParams.append('tap_id', tapId);
        
        navigate(`/payment-failed?${failedParams.toString()}`);
      } else {
        // Continue polling for pending statuses, but with exponential backoff
        const delay = Math.min(2000 + (currentPollCount * 500), 5000); // 2s to 5s delay
        console.log(`Payment still ${paymentStatus}, polling again in ${delay}ms...`);
        setTimeout(() => poll(currentPollCount + 1), delay);
      }
    };

    // Start polling
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
