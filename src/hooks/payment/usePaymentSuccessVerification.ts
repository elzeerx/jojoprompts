
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { logInfo, logError } from '@/utils/secureLogging';

interface PaymentSuccessVerificationProps {
  params: {
    planId: string | null;
    userId: string | null;
    token: string | null;
    payerId: string | null;
    allParams: Record<string, string>;
  };
  setVerifying: (verifying: boolean) => void;
  setVerified: (verified: boolean) => void;
  setError: (error: string | null) => void;
}

export function usePaymentSuccessVerification({
  params,
  setVerifying,
  setVerified,
  setError
}: PaymentSuccessVerificationProps) {
  const navigate = useNavigate();

  useEffect(() => {
    const verifyPayment = async () => {
      console.log('[Payment Verification] Starting verification with params:', params);
      
      try {
        // Extract payment ID from various possible sources
        const paymentId = params.allParams.paymentId || params.token || params.allParams.token;
        const method = params.allParams.method;

        if (!paymentId) {
          throw new Error('No payment ID found in URL parameters');
        }

        if (!params.planId || !params.userId) {
          throw new Error('Missing required plan ID or user ID');
        }

        // Skip PayPal verification for discount payments
        if (method === 'discount') {
          console.log('[Payment Verification] Discount payment detected, skipping PayPal verification');
          logInfo("Discount payment verification skipped", "payment", { 
            paymentId: paymentId,
            planId: params.planId 
          }, params.userId);
          
          setVerified(true);
          setVerifying(false);
          return;
        }

        // For regular PayPal payments, proceed with verification
        console.log('[Payment Verification] Verifying PayPal payment:', paymentId);
        
        const { data, error } = await supabase.functions.invoke('verify-paypal-payment', {
          body: {
            paymentId: paymentId,
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
          paymentId: paymentId,
          planId: params.planId 
        }, params.userId);
        
        setVerified(true);
        setVerifying(false);

      } catch (error: any) {
        console.error('[Payment Verification] Error:', error);
        logError("Payment verification failed", "payment", { 
          error: error.message,
          paymentId: params.allParams.paymentId || params.token
        }, params.userId);
        
        setError(error.message || 'Payment verification failed');
        setVerifying(false);
        
        // Navigate to failure page for verification errors
        const failureParams = new URLSearchParams({
          planId: params.planId || '',
          reason: error.message || 'Payment verification failed'
        });
        
        navigate(`/payment-failed?${failureParams.toString()}`);
      }
    };

    if (params.planId && params.userId) {
      verifyPayment();
    } else {
      console.error('[Payment Verification] Missing required parameters');
      setError('Missing payment information');
      setVerifying(false);
    }
  }, [params, navigate, setVerifying, setVerified, setError]);
}
