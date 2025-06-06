
import React, { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface PayPalPaymentButtonProps {
  amount: number;
  planName: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
  disabled?: boolean;
}

declare global {
  interface Window {
    paypal?: any;
  }
}

export function PayPalPaymentButton({
  amount,
  planName,
  onSuccess,
  onError,
  disabled = false
}: PayPalPaymentButtonProps) {
  const paypalRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = React.useState(false);
  const [paypalClientId, setPaypalClientId] = React.useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = React.useState(false);

  useEffect(() => {
    const loadPaypalClientId = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('paypal-client-id');
        if (data?.clientId) {
          setPaypalClientId(data.clientId);
        } else {
          console.error('Failed to load PayPal client ID:', error);
        }
      } catch (error) {
        console.error('Error loading PayPal client ID:', error);
      }
    };

    loadPaypalClientId();
  }, []);

  useEffect(() => {
    if (!paypalClientId || scriptLoaded) return;

    const loadPayPalScript = () => {
      if (window.paypal) {
        setScriptLoaded(true);
        renderPayPalButton();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${paypalClientId}&currency=USD`;
      script.onload = () => {
        setScriptLoaded(true);
        renderPayPalButton();
      };
      script.onerror = () => {
        onError({ message: 'Failed to load PayPal SDK' });
      };
      document.head.appendChild(script);
    };

    loadPayPalScript();
  }, [paypalClientId]);

  const renderPayPalButton = () => {
    if (!window.paypal || !paypalRef.current) return;

    // Clear existing button
    paypalRef.current.innerHTML = '';

    window.paypal.Buttons({
      createOrder: async () => {
        try {
          setLoading(true);
          const { data, error } = await supabase.functions.invoke('paypal-create-order', {
            body: { amount: amount.toString() }
          });

          if (error || !data?.id) {
            throw new Error('Failed to create PayPal order');
          }

          return data.id;
        } catch (error) {
          console.error('PayPal order creation error:', error);
          onError({ message: 'Failed to create PayPal order' });
          throw error;
        } finally {
          setLoading(false);
        }
      },
      onApprove: async (data: any) => {
        try {
          setLoading(true);
          
          // Capture the payment
          const { data: captureData, error } = await supabase.functions.invoke('paypal-capture-order', {
            body: { orderId: data.orderID }
          });

          if (error || !captureData?.success) {
            throw new Error('Payment capture failed');
          }

          toast({
            title: "Payment Successful!",
            description: "Your PayPal payment has been processed successfully.",
          });

          onSuccess({
            paymentId: data.orderID,
            paymentMethod: 'paypal',
            amount,
            currency: 'USD',
            captureId: captureData.captureId
          });

        } catch (error) {
          console.error('PayPal capture error:', error);
          onError({ message: 'Payment capture failed' });
        } finally {
          setLoading(false);
        }
      },
      onError: (err: any) => {
        console.error('PayPal error:', err);
        onError({ message: 'PayPal payment failed' });
        setLoading(false);
      },
      onCancel: () => {
        toast({
          title: "Payment Cancelled",
          description: "PayPal payment was cancelled.",
          variant: "destructive",
        });
        setLoading(false);
      }
    }).render(paypalRef.current);
  };

  if (!paypalClientId) {
    return (
      <Button disabled className="w-full">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading PayPal...
      </Button>
    );
  }

  return (
    <div className="w-full">
      {loading && (
        <div className="flex items-center justify-center p-4 bg-blue-50 rounded-lg mb-2">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span className="text-sm">Processing PayPal payment...</span>
        </div>
      )}
      <div ref={paypalRef} className={disabled ? 'pointer-events-none opacity-50' : ''} />
      {!scriptLoaded && (
        <Button disabled className="w-full">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Loading PayPal Buttons...
        </Button>
      )}
    </div>
  );
}
