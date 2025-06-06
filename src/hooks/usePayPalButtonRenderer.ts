
import { useRef } from 'react';

interface PayPalButtonConfig {
  amount: number;
  planName: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
  onStart?: () => void;
  logPayPalEvent: (event: string, data?: any) => void;
  isComponentMounted: () => boolean;
}

export function usePayPalButtonRenderer() {
  const paypalRef = useRef<HTMLDivElement>(null);

  const renderPayPalButton = (config: PayPalButtonConfig) => {
    const { amount, planName, onSuccess, onError, onStart, logPayPalEvent, isComponentMounted } = config;

    if (!window.paypal || !paypalRef.current || paypalRef.current.hasChildNodes() || !isComponentMounted()) {
      return;
    }

    logPayPalEvent('Button Rendering Started');

    try {
      window.paypal.Buttons({
        createOrder: (data: any, actions: any) => {
          logPayPalEvent('Order Creation Started');
          onStart?.();
          return actions.order.create({
            purchase_units: [{
              amount: {
                value: amount.toString(),
                currency_code: 'USD'
              },
              description: `${planName} Plan`
            }]
          });
        },
        onApprove: async (data: any, actions: any) => {
          try {
            logPayPalEvent('Payment Approved', { orderID: data.orderID });
            const details = await actions.order.capture();
            logPayPalEvent('Payment Captured Successfully', { 
              orderID: data.orderID,
              status: details.status 
            });
            onSuccess({
              paymentId: data.orderID,
              paymentMethod: 'paypal',
              details
            });
          } catch (error: any) {
            logPayPalEvent('Capture Error', { error: error.message });
            onError({
              message: error.message || 'Payment capture failed',
              code: 'CAPTURE_ERROR'
            });
          }
        },
        onError: (error: any) => {
          logPayPalEvent('Payment Error', { error: error.message || error });
          onError({
            message: error.message || 'PayPal payment failed',
            code: 'PAYPAL_ERROR'
          });
        },
        onCancel: () => {
          logPayPalEvent('Payment Cancelled');
        }
      }).render(paypalRef.current);
      
      logPayPalEvent('Button Rendered Successfully');
    } catch (error: any) {
      logPayPalEvent('Button Render Error', { error: error.message });
      onError({
        message: 'Failed to render PayPal button',
        code: 'RENDER_ERROR',
        critical: true
      });
    }
  };

  const clearButtonContainer = () => {
    if (paypalRef.current) {
      paypalRef.current.innerHTML = '';
    }
  };

  return {
    paypalRef,
    renderPayPalButton,
    clearButtonContainer
  };
}
