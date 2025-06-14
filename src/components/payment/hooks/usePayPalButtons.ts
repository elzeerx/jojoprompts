
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UsePayPalButtonsProps {
  amount: number;
  planId: string;
  userId: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
  disabled: boolean;
  isSDKLoaded: boolean;
}

export function usePayPalButtons({
  amount,
  planId,
  userId,
  onSuccess,
  onError,
  disabled,
  isSDKLoaded
}: UsePayPalButtonsProps) {
  const paypalRef = useRef<HTMLDivElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!window.paypal || !paypalRef.current || disabled || !isSDKLoaded) {
      return;
    }

    // Clear any existing buttons
    paypalRef.current.innerHTML = '';

    const buttons = window.paypal.Buttons({
      style: {
        color: 'gold',
        shape: 'rect',
        label: 'paypal',
        height: 50
      },
      
      createOrder: async () => {
        try {
          setIsProcessing(true);
          
          const { data, error } = await supabase.functions.invoke('create-paypal-order', {
            body: { planId, userId, amount }
          });

          if (error || !data?.success) {
            throw new Error(error?.message || 'Failed to create payment order');
          }

          return data.id;
        } catch (error) {
          console.error('[PayPal] Create order error:', error);
          setIsProcessing(false);
          onError(error);
          throw error;
        }
      },

      onApprove: async (data: any) => {
        try {
          const { data: captureData, error: captureError } = await supabase.functions.invoke('capture-paypal-payment', {
            body: {
              orderId: data.orderID,
              planId,
              userId
            }
          });

          if (captureError || !captureData?.success) {
            throw new Error(captureError?.message || 'Payment processing failed');
          }

          setIsProcessing(false);

          onSuccess({
            paymentMethod: 'paypal',
            paymentId: captureData.captureId,
            orderId: data.orderID,
            status: captureData.status,
            payerEmail: captureData.payerEmail,
            details: {
              id: captureData.captureId,
              status: captureData.status,
              amount: amount
            }
          });

        } catch (error) {
          console.error('[PayPal] Payment approval error:', error);
          setIsProcessing(false);
          onError(error);
        }
      },

      onCancel: () => {
        setIsProcessing(false);
        onError(new Error('Payment was cancelled by user'));
      },

      onError: (err: any) => {
        console.error('[PayPal] Payment error:', err);
        setIsProcessing(false);
        onError(err);
      }
    });

    buttons.render(paypalRef.current).catch((err: any) => {
      console.error('[PayPal] Button render error:', err);
      onError(new Error('Unable to initialize PayPal payment buttons'));
    });
  }, [window.paypal, disabled, amount, planId, userId, onSuccess, onError, isSDKLoaded]);

  return { paypalRef, isProcessing };
}
