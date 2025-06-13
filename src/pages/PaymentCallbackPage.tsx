
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function PaymentCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<string>('checking');
  const [error, setError] = useState<string | null>(null);

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

    const poll = async () => {
      try {
        // Build query parameters for the verify-tap function
        const params = new URLSearchParams();
        if (ref) params.append('reference', ref);
        if (tapId) params.append('tap_id', tapId);
        
        console.log('Calling verify-tap function with params:', params.toString());

        // Call the verify-tap edge function using supabase.functions.invoke
        const { data, error } = await supabase.functions.invoke('verify-tap', {
          method: 'GET'
        });

        // If the function call fails, try direct API call as fallback
        if (error || !data) {
          console.log('Function invoke failed, trying direct API call:', error);
          
          const apiUrl = `${supabase.supabaseUrl}/functions/v1/verify-tap?${params.toString()}`;
          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${supabase.supabaseKey}`,
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Direct API call failed:', errorText);
            throw new Error(`API call failed: ${response.status}`);
          }

          const result = await response.json();
          const paymentStatus = result.status;
          
          console.log('Payment status from direct API:', paymentStatus);
          setStatus(paymentStatus);

          if (paymentStatus === 'CAPTURED') {
            // Get current URL parameters to pass to success page
            const planId = searchParams.get('planId') || searchParams.get('plan_id');
            const userId = searchParams.get('userId') || searchParams.get('user_id');
            
            const successParams = new URLSearchParams();
            if (planId) successParams.append('planId', planId);
            if (userId) successParams.append('userId', userId);
            if (tapId) successParams.append('tap_id', tapId);
            if (ref) successParams.append('reference', ref);
            
            navigate(`/payment-success?${successParams.toString()}`);
          } else if (['FAILED', 'DECLINED', 'CANCELLED', 'VOIDED', 'ERROR'].includes(paymentStatus)) {
            const planId = searchParams.get('planId') || searchParams.get('plan_id');
            const failedParams = new URLSearchParams();
            if (planId) failedParams.append('planId', planId);
            failedParams.append('reason', `Payment ${paymentStatus.toLowerCase()}`);
            if (tapId) failedParams.append('tap_id', tapId);
            
            navigate(`/payment-failed?${failedParams.toString()}`);
          } else {
            // Continue polling for pending statuses
            console.log('Payment still pending, polling again in 2 seconds...');
            setTimeout(poll, 2000);
          }
        } else {
          // Handle successful function call
          const paymentStatus = data.status;
          console.log('Payment status from function:', paymentStatus);
          setStatus(paymentStatus);

          if (paymentStatus === 'CAPTURED') {
            const planId = searchParams.get('planId') || searchParams.get('plan_id');
            const userId = searchParams.get('userId') || searchParams.get('user_id');
            
            const successParams = new URLSearchParams();
            if (planId) successParams.append('planId', planId);
            if (userId) successParams.append('userId', userId);
            if (tapId) successParams.append('tap_id', tapId);
            if (ref) successParams.append('reference', ref);
            
            navigate(`/payment-success?${successParams.toString()}`);
          } else if (['FAILED', 'DECLINED', 'CANCELLED', 'VOIDED', 'ERROR'].includes(paymentStatus)) {
            const planId = searchParams.get('planId') || searchParams.get('plan_id');
            const failedParams = new URLSearchParams();
            if (planId) failedParams.append('planId', planId);
            failedParams.append('reason', `Payment ${paymentStatus.toLowerCase()}`);
            if (tapId) failedParams.append('tap_id', tapId);
            
            navigate(`/payment-failed?${failedParams.toString()}`);
          } else {
            console.log('Payment still pending, polling again in 2 seconds...');
            setTimeout(poll, 2000);
          }
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

    // Start polling
    poll();
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
          <p className="mt-2">This may take a few moments</p>
        </div>
      </div>
    </div>
  );
}
