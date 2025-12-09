import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SessionManager } from '@/hooks/payment/helpers/sessionManager';
import { formatKWD } from '@/utils/currencyUtils';
import { toast } from '@/hooks/use-toast';

interface AppliedDiscount {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
}

interface SimpleUpayButtonProps {
  amountKWD: number;
  amountUSD: number;
  planId: string;
  userId: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
  appliedDiscount?: AppliedDiscount | null;
  language?: string;
}

/**
 * Upayments payment button component
 * Handles both 100% discount activation and redirect to Upayments checkout
 */
export function SimpleUpayButton({
  amountKWD,
  amountUSD,
  planId,
  userId,
  onSuccess,
  onError,
  appliedDiscount,
  language = 'en'
}: SimpleUpayButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const is100PercentDiscount = amountKWD === 0;

  // Handle 100% discount - direct activation without payment
  const handleDirectActivation = async () => {
    setIsProcessing(true);
    try {
      console.log('[SimpleUpayButton] Processing 100% discount activation', { planId, userId });

      const { data, error } = await supabase.functions.invoke('process-upayments-payment', {
        body: {
          action: 'direct-activation',
          planId,
          userId,
          amountKWD: 0,
          amountUSD: 0,
          appliedDiscount,
          language
        }
      });

      if (error) throw error;

      if (data?.success) {
        console.log('[SimpleUpayButton] Direct activation successful', data);
        onSuccess({
          paymentId: data.paymentId,
          transactionId: data.transactionId,
          paymentMethod: 'discount_100_percent_upayments',
          status: 'COMPLETED'
        });
      } else {
        throw new Error(data?.error || 'Failed to activate subscription');
      }
    } catch (error) {
      console.error('[SimpleUpayButton] Direct activation error:', error);
      onError(error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle redirect to Upayments checkout
  const handleUpayRedirect = async () => {
    setIsProcessing(true);
    try {
      console.log('[SimpleUpayButton] Initiating Upayments checkout', { planId, userId, amountKWD });

      // Backup session for recovery after redirect (same pattern as PayPal)
      try {
        await SessionManager.backupSession(userId, planId);
        console.log('[SimpleUpayButton] Session backed up successfully');
      } catch (backupError) {
        console.warn('[SimpleUpayButton] Session backup failed (continuing anyway):', backupError);
      }

      // Store payment context for recovery
      try {
        localStorage.setItem('upayments_payment_context', JSON.stringify({
          planId,
          userId,
          amountKWD,
          amountUSD,
          appliedDiscount,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn('[SimpleUpayButton] Failed to store payment context:', e);
      }

      const { data, error } = await supabase.functions.invoke('process-upayments-payment', {
        body: {
          action: 'create',
          planId,
          userId,
          amountKWD,
          amountUSD,
          appliedDiscount,
          language
        }
      });

      if (error) throw error;

      if (data?.success && data?.approvalUrl) {
        console.log('[SimpleUpayButton] Redirecting to Upayments checkout', { approvalUrl: data.approvalUrl });
        
        // Store track ID for verification
        if (data.trackId) {
          localStorage.setItem('upayments_track_id', data.trackId);
        }
        
        // Redirect to Upayments checkout page
        window.location.href = data.approvalUrl;
      } else {
        throw new Error(data?.error || 'Failed to create payment');
      }
    } catch (error) {
      console.error('[SimpleUpayButton] Upayments redirect error:', error);
      setIsProcessing(false);
      onError(error);
      toast({
        variant: 'destructive',
        title: 'Payment Error',
        description: error instanceof Error ? error.message : 'Failed to initiate payment'
      });
    }
  };

  const handlePayment = () => {
    if (is100PercentDiscount) {
      handleDirectActivation();
    } else {
      handleUpayRedirect();
    }
  };

  if (isProcessing) {
    return (
      <Button disabled className="w-full h-12 bg-warm-gold hover:bg-warm-gold/90">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Processing...
      </Button>
    );
  }

  return (
    <Button
      onClick={handlePayment}
      className="w-full h-12 bg-warm-gold hover:bg-warm-gold/90 text-white font-medium"
    >
      {is100PercentDiscount ? (
        <>
          <Sparkles className="w-4 h-4 mr-2" />
          Activate Free Subscription
        </>
      ) : (
        <>
          <CreditCard className="w-4 h-4 mr-2" />
          Pay {formatKWD(amountKWD)}
        </>
      )}
    </Button>
  );
}
