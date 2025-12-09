import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SessionManager } from '@/hooks/payment/helpers/sessionManager';

/**
 * Callback page for Upayments payment returns
 * Handles both success and failure cases from Upayments redirect
 * 
 * Upayments appends their params directly to our returnUrl, so we:
 * 1. Parse Upayments' params (result, payment_id, invoice_id, etc.) from URL
 * 2. Get our context (planId, userId, trackId) from localStorage
 */
export default function UpaymentCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'failed'>('processing');
  const [message, setMessage] = useState('Verifying your payment...');

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Parse Upayments' callback parameters
        const result = searchParams.get('result'); // CAPTURED, NOT CAPTURED, etc.
        const paymentId = searchParams.get('payment_id');
        const invoiceId = searchParams.get('invoice_id');
        const upayTrackId = searchParams.get('track_id'); // Upayments' track_id
        const orderId = searchParams.get('order_id');
        const requestedOrderId = searchParams.get('requested_order_id');

        console.log('[UpaymentCallback] Received Upayments params:', { 
          result, paymentId, invoiceId, upayTrackId, orderId, requestedOrderId,
          allParams: Object.fromEntries(searchParams.entries())
        });

        // Get our payment context from localStorage (stored before redirect)
        let paymentContext = null;
        try {
          const storedContext = localStorage.getItem('upayments_payment_context');
          if (storedContext) {
            paymentContext = JSON.parse(storedContext);
          }
        } catch (e) {
          console.warn('[UpaymentCallback] Failed to parse payment context:', e);
        }

        const ourTrackId = localStorage.getItem('upayments_track_id');
        
        console.log('[UpaymentCallback] Retrieved from localStorage:', { 
          paymentContext, 
          ourTrackId 
        });

        // Determine success based on Upayments' result parameter
        const isSuccess = result === 'CAPTURED' || result === 'SUCCESS';
        
        if (!isSuccess) {
          console.log('[UpaymentCallback] Payment not successful, result:', result);
          setStatus('failed');
          setMessage(result ? `Payment ${result.toLowerCase()}` : 'Payment was cancelled or failed');
          
          // Clean up storage
          localStorage.removeItem('upayments_payment_context');
          localStorage.removeItem('upayments_track_id');
          SessionManager.cleanup();
          
          // Redirect to failure page after delay
          setTimeout(() => {
            const planId = paymentContext?.planId;
            navigate(`/payment-failed?reason=cancelled&gateway=upayments${planId ? `&planId=${planId}` : ''}`);
          }, 2000);
          return;
        }

        // Attempt to restore session
        try {
          const restored = await SessionManager.restoreSession();
          if (restored.success) {
            console.log('[UpaymentCallback] Session restored successfully');
          }
        } catch (e) {
          console.warn('[UpaymentCallback] Session restore failed:', e);
        }

        const effectivePlanId = paymentContext?.planId;
        const effectiveUserId = paymentContext?.userId;
        const effectiveTrackId = ourTrackId || paymentContext?.trackId;

        console.log('[UpaymentCallback] Attempting verification with:', { 
          ourTrackId: effectiveTrackId,
          upayInvoiceId: invoiceId,
          upayPaymentId: paymentId,
          planId: effectivePlanId, 
          userId: effectiveUserId 
        });

        if (!effectivePlanId || !effectiveUserId) {
          console.error('[UpaymentCallback] Missing planId or userId from localStorage');
          throw new Error('Payment context not found. Please try again.');
        }

        // Verify payment with backend
        const { data, error } = await supabase.functions.invoke('process-upayments-payment', {
          body: {
            action: 'verify',
            trackId: effectiveTrackId,
            invoiceId: invoiceId,
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
