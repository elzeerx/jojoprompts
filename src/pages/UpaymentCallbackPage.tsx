import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SessionManager } from '@/hooks/payment/helpers/sessionManager';

/**
 * Callback page for Upayments payment returns
 * Handles both success and failure cases from Upayments redirect
 */
export default function UpaymentCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'failed'>('processing');
  const [message, setMessage] = useState('Verifying your payment...');

  useEffect(() => {
    const processCallback = async () => {
      try {
        const success = searchParams.get('success') === 'true';
        const planId = searchParams.get('plan_id');
        const userId = searchParams.get('user_id');
        const trackId = searchParams.get('track_id') || localStorage.getItem('upayments_track_id');

        console.log('[UpaymentCallback] Processing callback', { success, planId, userId, trackId });

        // Attempt to restore session
        try {
          const restored = await SessionManager.restoreSession();
          if (restored.success) {
            console.log('[UpaymentCallback] Session restored successfully');
          }
        } catch (e) {
          console.warn('[UpaymentCallback] Session restore failed:', e);
        }

        // Get stored payment context
        let paymentContext = null;
        try {
          const storedContext = localStorage.getItem('upayments_payment_context');
          if (storedContext) {
            paymentContext = JSON.parse(storedContext);
          }
        } catch (e) {
          console.warn('[UpaymentCallback] Failed to parse payment context:', e);
        }

        if (!success) {
          setStatus('failed');
          setMessage('Payment was cancelled or failed');
          
          // Clean up storage
          localStorage.removeItem('upayments_payment_context');
          localStorage.removeItem('upayments_track_id');
          SessionManager.cleanup();
          
          // Redirect to failure page after delay
          setTimeout(() => {
            navigate(`/payment-failed?reason=cancelled&gateway=upayments${planId ? `&planId=${planId}` : ''}`);
          }, 2000);
          return;
        }

        // Get invoice_id from URL if present (Upayments might add it)
        const invoiceId = searchParams.get('invoice_id') || searchParams.get('invoiceId');
        
        const effectivePlanId = planId || paymentContext?.planId;
        const effectiveUserId = userId || paymentContext?.userId;

        console.log('[UpaymentCallback] Attempting verification with:', { 
          trackId, 
          invoiceId,
          planId: effectivePlanId, 
          userId: effectiveUserId 
        });

        // Verify payment with backend - includes fallback strategies
        const { data, error } = await supabase.functions.invoke('process-upayments-payment', {
          body: {
            action: 'verify',
            trackId,
            invoiceId,
            planId: effectivePlanId,
            userId: effectiveUserId,
            paymentSuccess: true,
            appliedDiscount: paymentContext?.appliedDiscount
          }
        });

        console.log('[UpaymentCallback] Verification response:', { data, error });

        // Clean up storage
        localStorage.removeItem('upayments_payment_context');
        localStorage.removeItem('upayments_track_id');
        SessionManager.cleanup();

        if (error) {
          console.error('[UpaymentCallback] Verification error:', error);
          throw error;
        }

        if (data?.success) {
          setStatus('success');
          setMessage('Payment successful! Redirecting...');
          
          // Redirect to success page
          setTimeout(() => {
            navigate(`/payment-success?planId=${effectivePlanId}&userId=${effectiveUserId}&gateway=upayments&status=completed`);
          }, 1500);
        } else {
          throw new Error(data?.error || 'Payment verification failed');
        }

      } catch (error) {
        console.error('[UpaymentCallback] Error processing callback:', error);
        setStatus('failed');
        setMessage(error instanceof Error ? error.message : 'An error occurred');
        
        // Clean up and redirect to failure
        localStorage.removeItem('upayments_payment_context');
        localStorage.removeItem('upayments_track_id');
        SessionManager.cleanup();
        
        setTimeout(() => {
          navigate('/payment-failed?reason=error&gateway=upayments');
        }, 3000);
      }
    };

    processCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-soft-bg to-white">
      <div className="text-center p-8 bg-white rounded-2xl shadow-lg max-w-md w-full mx-4">
        {status === 'processing' && (
          <>
            <Loader2 className="w-16 h-16 text-warm-gold animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-dark-base mb-2">Processing Payment</h2>
            <p className="text-muted-foreground">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-dark-base mb-2">Payment Successful!</h2>
            <p className="text-muted-foreground">{message}</p>
          </>
        )}

        {status === 'failed' && (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-dark-base mb-2">Payment Failed</h2>
            <p className="text-muted-foreground">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}
