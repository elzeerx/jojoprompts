
import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

declare global {
  interface Window {
    paypal?: any;
  }
}

interface SimplePayPalButtonProps {
  amount: number;
  planId: string;
  userId: string;
  onSuccess: (data: any) => void;
  onError: (error: any) => void;
}

export function SimplePayPalButton({ 
  amount, 
  planId, 
  userId, 
  onSuccess, 
  onError 
}: SimplePayPalButtonProps) {
  const paypalRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);

  // Get PayPal client ID
  useEffect(() => {
    const getClientId = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-paypal-client-id');
        if (error) throw error;
        setClientId(data.clientId);
      } catch (error) {
        console.error('Failed to get PayPal client ID:', error);
        onError(new Error('Payment system unavailable'));
      }
    };
    getClientId();
  }, [onError]);

  // Load PayPal SDK
  useEffect(() => {
    if (!clientId) return;

    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
    script.onload = () => setIsLoading(false);
    script.onerror = () => onError(new Error('Failed to load PayPal SDK'));
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [clientId, onError]);

  // Initialize PayPal buttons
  useEffect(() => {
    if (isLoading || !window.paypal || !paypalRef.current) return;

    // Clear existing buttons
    paypalRef.current.innerHTML = '';

    window.paypal.Buttons({
      style: {
        color: 'gold',
        shape: 'rect',
        layout: 'vertical',
        height: 50
      },

      createOrder: async () => {
        try {
          setIsProcessing(true);
          
          // Store payment context for redirect return
          const paymentContext = {
            planId,
            userId,
            amount,
            timestamp: Date.now()
          };
          localStorage.setItem('pending_payment', JSON.stringify(paymentContext));
          
          const { data, error } = await supabase.functions.invoke('process-paypal-payment', {
            body: { 
              action: 'create',
              planId,
              userId,
              amount
            }
          });

          if (error || !data.success) {
            throw new Error(error?.message || 'Failed to create payment order');
          }

          console.log('PayPal order created:', data.orderId);
          return data.orderId;
        } catch (error) {
          setIsProcessing(false);
          localStorage.removeItem('pending_payment');
          onError(error);
          throw error;
        }
      },

      onApprove: async (data: any) => {
        try {
          console.log('PayPal payment approved, redirecting to PayPal...');
          
          // Get the approval URL and redirect to PayPal
          const approvalUrl = data.links?.find((link: any) => link.rel === 'approve')?.href;
          
          if (approvalUrl) {
            // Redirect to PayPal for payment completion
            window.location.href = approvalUrl;
          } else {
            // Fallback: try to capture the payment directly
            const { data: captureData, error } = await supabase.functions.invoke('process-paypal-payment', {
              body: {
                action: 'capture',
                orderId: data.orderID,
                planId,
                userId
              }
            });

            if (error || !captureData.success) {
              throw new Error(error?.message || 'Payment processing failed');
            }

            setIsProcessing(false);
            localStorage.removeItem('pending_payment');
            
            toast({
              title: "Payment Successful!",
              description: "Your subscription has been activated.",
            });

            onSuccess({
              paymentId: captureData.paymentId,
              transactionId: captureData.transactionId,
              status: captureData.status
            });
          }

        } catch (error) {
          setIsProcessing(false);
          localStorage.removeItem('pending_payment');
          onError(error);
        }
      },

      onCancel: () => {
        setIsProcessing(false);
        localStorage.removeItem('pending_payment');
        toast({
          title: "Payment Cancelled",
          description: "You can try again when ready.",
        });
      },

      onError: (err: any) => {
        setIsProcessing(false);
        localStorage.removeItem('pending_payment');
        onError(err);
      }
    }).render(paypalRef.current);
  }, [isLoading, amount, planId, userId, onSuccess, onError]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading PayPal...</span>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="flex items-center justify-center py-8 bg-blue-50 border border-blue-200 rounded-lg">
        <Loader2 className="h-6 w-6 animate-spin mr-2 text-blue-600" />
        <span className="text-blue-700 font-medium">Redirecting to PayPal...</span>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div ref={paypalRef} className="min-h-[50px]" />
      <p className="text-xs text-gray-500 text-center mt-2">
        🔒 You will be redirected to PayPal to complete your payment securely
      </p>
    </div>
  );
}
