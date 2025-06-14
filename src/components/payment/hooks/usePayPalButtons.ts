
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
          console.log('[PayPal] Creating order:', { planId, userId, amount });
          setIsProcessing(true);
          
          const { data, error } = await supabase.functions.invoke('create-paypal-order', {
            body: { planId, userId, amount }
          });

          console.log('[PayPal] Create order response:', { data, error });

          if (error || !data?.success) {
            throw new Error(error?.message || 'Failed to create payment order');
          }

          console.log('[PayPal] Order created successfully:', data.id);
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
          console.log('[PayPal] Payment approved, capturing:', data.orderID);
          
          const { data: captureData, error: captureError } = await supabase.functions.invoke('capture-paypal-payment', {
            body: {
              orderId: data.orderID,
              planId,
              userId
            }
          });

          console.log('[PayPal] Capture response:', { captureData, captureError });

          if (captureError) {
            console.error('[PayPal] Capture error:', captureError);
            throw new Error(captureError.message || 'Payment processing failed');
          }

          if (!captureData || !captureData.success) {
            console.error('[PayPal] Capture unsuccessful:', captureData);
            throw new Error('Payment processing failed');
          }

          console.log('[PayPal] Payment captured successfully:', {
            status: captureData.status,
            captureId: captureData.captureId
          });

          setIsProcessing(false);

          // Create proper success payload that matches what handlePaymentSuccess expects
          const successPayload = {
            paymentMethod: 'paypal',
            paymentId: captureData.captureId,
            orderId: data.orderID,
            status: captureData.status || 'COMPLETED',
            payerEmail: captureData.payerEmail,
            planId: planId,
            userId: userId,
            details: {
              id: captureData.captureId,
              status: captureData.status || 'COMPLETED',
              amount: amount,
              orderId: data.orderID
            }
          };

          console.log('[PayPal] Calling onSuccess with payload:', successPayload);
          onSuccess(successPayload);

        } catch (error) {
          console.error('[PayPal] Payment approval error:', error);
          setIsProcessing(false);
          onError(error);
        }
      },

      onCancel: () => {
        console.log('[PayPal] Payment cancelled by user');
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
