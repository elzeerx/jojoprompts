
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, AlertTriangle } from "lucide-react";

export default function PaymentCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<string>('checking');
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const MAX_POLLS = 20; // 40 seconds max

  useEffect(() => {
    // Log all available parameters for debugging
    const allParams = {};
    searchParams.forEach((value, key) => {
      allParams[key] = value;
    });
    console.log('Payment callback - All URL parameters:', allParams);
    console.log('Payment callback - Full URL:', window.location.href);

    // Check if this is a PayPal success/cancel callback
    const success = searchParams.get('success');
    const paymentId = searchParams.get('paymentId') || searchParams.get('payment_id');
    const payerId = searchParams.get('PayerID') || searchParams.get('payer_id');
    const orderId = searchParams.get('token') || searchParams.get('order_id');
    const planId = searchParams.get('plan_id');
    const userId = searchParams.get('user_id');

    console.log('PayPal callback extracted parameters:', { 
      success,
      paymentId, 
      payerId,
      orderId,
      planId,
      userId,
      originalParams: allParams 
    });

    // Handle PayPal cancel
    if (success === 'false') {
      console.log('PayPal payment cancelled');
      setError('Payment was cancelled');
      setTimeout(() => {
        navigate(`/payment-failed?planId=${planId || ''}&reason=Payment cancelled`);
      }, 3000);
      return;
    }

    // Check for required PayPal parameters
    if (!orderId && !paymentId) {
      console.error('No PayPal payment identifier found in URL parameters');
      setError('Missing payment information in callback URL');
      setTimeout(() => {
        navigate(`/payment-failed?planId=${planId || ''}&reason=Missing payment reference`);
      }, 3000);
      return;
    }

    const poll = async (currentPollCount: number = 0) => {
      if (currentPollCount >= MAX_POLLS) {
        console.log('Maximum polling attempts reached');
        setError('Payment verification timeout');
        setTimeout(() => {
          navigate(`/payment-failed?planId=${planId || ''}&reason=Payment verification timeout`);
        }, 3000);
        return;
      }

      try {
        // Build query parameters for the verify-paypal-payment function
        const params = new URLSearchParams();
        if (orderId) params.append('order_id', orderId);
        if (paymentId) params.append('payment_id', paymentId);
        
        console.log(`Polling attempt ${currentPollCount + 1}/${MAX_POLLS} - Calling verify-paypal-payment with params:`, params.toString());

        // Use direct HTTP GET request to the verify-paypal-payment function
        const SUPABASE_URL = "https://fxkqgjakbyrxkmevkglv.supabase.co";
        const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4a3FnamFrYnlyeGttZXZrZ2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ4ODY4NjksImV4cCI6MjA2MDQ2Mjg2OX0.u4O7nvVrW6HZjZj058T9kKpEfa5BsyWT0i_p4UxcZi4";
        
        const apiUrl = `${SUPABASE_URL}/functions/v1/verify-paypal-payment?${params.toString()}`;
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Verify-paypal-payment API call failed:', { 
            status: response.status, 
            statusText: response.statusText,
            error: errorText 
          });
          throw new Error(`API call failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('Verify-paypal-payment response:', result, 'Poll count:', currentPollCount + 1);
        
        handlePaymentStatus(result.status, currentPollCount);

      } catch (error: any) {
        console.error('Payment verification error:', error);
        setError(error.message);
        setTimeout(() => {
          navigate(`/payment-failed?planId=${planId || ''}&reason=Payment verification failed: ${error.message}`);
        }, 3000);
      }
    };

    const handlePaymentStatus = (paymentStatus: string, currentPollCount: number) => {
      console.log('Processing payment status:', paymentStatus, 'Poll count:', currentPollCount + 1);
      setStatus(paymentStatus);
      setPollCount(currentPollCount + 1);

      if (paymentStatus === 'COMPLETED') {
        // Payment successful
        console.log('Payment completed successfully, redirecting to success page');
        
        const successParams = new URLSearchParams();
        if (planId) successParams.append('planId', planId);
        if (userId) successParams.append('userId', userId);
        if (paymentId) successParams.append('payment_id', paymentId);
        if (orderId) successParams.append('order_id', orderId);
        
        navigate(`/payment-success?${successParams.toString()}`);
      } else if (['FAILED', 'DECLINED', 'CANCELLED', 'VOIDED', 'ERROR'].includes(paymentStatus)) {
        // Payment failed
        console.log('Payment failed with status:', paymentStatus);
        const failedParams = new URLSearchParams();
        if (planId) failedParams.append('planId', planId);
        failedParams.append('reason', `Payment ${paymentStatus.toLowerCase()}`);
        failedParams.append('status', paymentStatus);
        if (paymentId) failedParams.append('payment_id', paymentId);
        
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
          Please wait while we verify your payment with PayPal...
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
