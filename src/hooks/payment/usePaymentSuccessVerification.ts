
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { logInfo, logError } from '@/utils/secureLogging';

interface PaymentSuccessParams {
  planId: string;
  userId: string;
  paymentId: string;
  status: string;
  method?: string;
}

export function usePaymentSuccessVerification(params: PaymentSuccessParams) {
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    const verifyPayment = async () => {
      console.log('[Payment Verification] Starting verification with params:', params);
      
      try {
        // Skip PayPal verification for discount payments
        if (params.method === 'discount') {
          console.log('[Payment Verification] Discount payment detected, skipping PayPal verification');
          logInfo("Discount payment verification skipped", "payment", { 
            paymentId: params.paymentId,
            planId: params.planId 
          }, params.userId);
          
          setVerificationStatus('success');
          return;
        }

        // For regular PayPal payments, proceed with verification
        console.log('[Payment Verification] Verifying PayPal payment:', params.paymentId);
        
        const { data, error } = await supabase.functions.invoke('verify-paypal-payment', {
          body: {
            paymentId: params.paymentId,
            planId: params.planId,
            userId: params.userId
          }
        });

        if (error) {
          console.error('[Payment Verification] Supabase function error:', error);
          throw new Error(error.message || 'Payment verification failed');
        }

        if (!data?.success) {
          console.error('[Payment Verification] Verification failed:', data);
          throw new Error(data?.error || 'Payment verification failed');
        }

        console.log('[Payment Verification] Payment verified successfully');
        logInfo("Payment verified successfully", "payment", { 
          paymentId: params.paymentId,
          planId: params.planId 
        }, params.userId);
        
        setVerificationStatus('success');

      } catch (error: any) {
        console.error('[Payment Verification] Error:', error);
        logError("Payment verification failed", "payment", { 
          error: error.message,
          paymentId: params.paymentId 
        }, params.userId);
        
        setErrorMessage(error.message || 'Payment verification failed');
        setVerificationStatus('error');
        
        // Navigate to failure page for verification errors
        const failureParams = new URLSearchParams({
          planId: params.planId,
          reason: error.message || 'Payment verification failed'
        });
        
        navigate(`/payment-failed?${failureParams.toString()}`);
      }
    };

    if (params.paymentId && params.planId && params.userId) {
      verifyPayment();
    } else {
      console.error('[Payment Verification] Missing required parameters');
      setErrorMessage('Missing payment information');
      setVerificationStatus('error');
    }
  }, [params, navigate]);

  return {
    verificationStatus,
    errorMessage
  };
}
