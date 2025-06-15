
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
  const MAX_POLLS = 20; // 40 seconds max

  useEffect(() => {
    // Log all available parameters for debugging
    const allParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      allParams[key] = value;
    });
    console.log('Payment callback - All URL parameters:', allParams);
    console.log('Payment callback - Full URL:', window.location.href);

    const success = searchParams.get('success');
    // PayPal returns payment/order information in these fields
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

    if (success === 'false') {
      console.log('PayPal payment cancelled');
      setError('Payment was cancelled');
      setTimeout(() => {
        navigate(`/payment-failed?planId=${planId || ''}&reason=Payment cancelled`);
      }, 3000);
      return;
    }

    if (!orderId && !paymentId) {
      console.error('No PayPal payment identifier found in URL parameters');
      setError('Missing payment information in callback URL');
      setTimeout(() => {
        navigate(`/payment-failed?planId=${planId || ''}&reason=Missing payment reference`);
      }, 3000);
      return;
    }

    let didCapture = false;

    const doCaptureIfNeeded = async (): Promise<{captured: boolean, paymentId?: string}> => {
      if (!orderId) {
        // If only paymentId is present, PayPal payment already captured, skip
        return { captured: false, paymentId };
      }
      // Call process-paypal-payment edge function with action: 'capture'
      try {
        const { data, error } = await supabase.functions.invoke("process-paypal-payment", {
          body: {
            action: 'capture',
            orderId,
            userId,
            planId,
          },
        });

        console.log('PayPal capture (supabase invoke) result:', { data, error });

        if (error || !data?.success) {
          throw new Error(error?.message || data?.error || "PayPal capture failed");
        }
        didCapture = true;
        return { captured: true, paymentId: data.paymentId };
      } catch (err: any) {
        setError('Payment capture failed: ' + (err.message || err));
        setTimeout(() => {
          navigate(`/payment-failed?planId=${planId || ''}&reason=Payment capture failed: ${(err.message || err)}`);
        }, 4000);
        throw err;
      }
    };

    const poll = async (currentPollCount: number = 0, paymentIdArg?: string) => {
      if (currentPollCount >= MAX_POLLS) {
        setError('Payment verification timeout');
        setTimeout(() => {
          navigate(`/payment-failed?planId=${planId || ''}&reason=Payment verification timeout`);
        }, 3000);
        return;
      }
      try {
        const args: Record<string, string> = {};
        if (orderId) args['order_id'] = orderId;
        if (paymentIdArg || paymentId) args['payment_id'] = paymentIdArg || paymentId!;
        const { data, error } = await supabase.functions.invoke("verify-paypal-payment", {
          body: args, // Even though the edge fn expects GET, supabase.functions.invoke only POSTs
        });
        // Workaround: since the edge function expects GET, we need to fallback to fetch
        let result = data;
        if (!data && (orderId || paymentIdArg || paymentId)) {
          const params = new URLSearchParams();
          if (orderId) params.append('order_id', orderId);
          if (paymentIdArg || paymentId) params.append('payment_id', paymentIdArg || paymentId!);
          const apiUrl = `https://fxkqgjakbyrxkmevkglv.supabase.co/functions/v1/verify-paypal-payment?${params.toString()}`;
          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API call failed: ${response.status} - ${errorText}`);
          }
          result = await response.json();
        }

        console.log('Verify-paypal-payment response:', result, 'Poll count:', currentPollCount + 1);
        handlePaymentStatus(result?.status, currentPollCount, paymentIdArg || paymentId);

      } catch (error: any) {
        setError(error.message);
        setTimeout(() => {
          navigate(`/payment-failed?planId=${planId || ''}&reason=Payment verification failed: ${error.message}`);
        }, 3000);
      }
    };

    const handlePaymentStatus = (paymentStatus: string, currentPollCount: number, paymentIdForSuccessParam?: string) => {
      setStatus(paymentStatus);
      setPollCount(currentPollCount + 1);

      if (paymentStatus === 'COMPLETED') {
        // Payment successful
        const successParams = new URLSearchParams();
        if (planId) successParams.append('planId', planId);
        if (userId) successParams.append('userId', userId);
        if (paymentIdForSuccessParam) successParams.append('payment_id', paymentIdForSuccessParam);
        if (orderId) successParams.append('order_id', orderId);

        navigate(`/payment-success?${successParams.toString()}`);
      } else if (['FAILED', 'DECLINED', 'CANCELLED', 'VOIDED', 'ERROR'].includes(paymentStatus)) {
        const failedParams = new URLSearchParams();
        if (planId) failedParams.append('planId', planId);
        failedParams.append('reason', `Payment ${paymentStatus.toLowerCase()}`);
        failedParams.append('status', paymentStatus);
        if (paymentIdForSuccessParam) failedParams.append('payment_id', paymentIdForSuccessParam);

        navigate(`/payment-failed?${failedParams.toString()}`);
      } else {
        const delay = Math.min(2000 + (currentPollCount * 200), 4000);
        setTimeout(() => poll(currentPollCount + 1, paymentIdForSuccessParam), delay);
      }
    };

    // ----------- Full Payment Callback Logic -----------
    if (success === 'true') {
      (async () => {
        // Step 1: Capture the payment (if needed)
        let paymentIdAfterCapture = paymentId;
        try {
          const captureResult = await doCaptureIfNeeded();
          if (captureResult.paymentId) paymentIdAfterCapture = captureResult.paymentId;
        } catch (err) {
          return;
        }
        // Step 2: Start verifying
        poll(0, paymentIdAfterCapture);
      })();
    } else {
      poll(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

