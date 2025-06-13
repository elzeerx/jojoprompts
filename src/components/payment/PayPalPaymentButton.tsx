
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    paypal?: any;
  }
}

interface PayPalPaymentButtonProps {
  amount: number;
  planName: string;
  planId: string;
  userId: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
  disabled?: boolean;
}

export function PayPalPaymentButton({
  amount,
  planName,
  planId,
  userId,
  onSuccess,
  onError,
  disabled = false
}: PayPalPaymentButtonProps) {
  const paypalRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);

  // Get PayPal client ID
  useEffect(() => {
    const getPayPalClientId = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-paypal-client-id');
        
        if (error) {
          console.error('Failed to get PayPal client ID:', error);
          onError(new Error('Failed to initialize PayPal'));
          return;
        }
        
        setClientId(data.clientId);
      } catch (error) {
        console.error('Error getting PayPal client ID:', error);
        onError(error);
      }
    };

    getPayPalClientId();
  }, [onError]);

  // Load PayPal SDK
  useEffect(() => {
    if (!clientId) return;

    const loadPayPalScript = () => {
      if (window.paypal) {
        setScriptLoaded(true);
        setIsLoading(false);
        return;
      }

      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&components=buttons`;
      script.onload = () => {
        setScriptLoaded(true);
        setIsLoading(false);
      };
      script.onerror = () => {
        console.error('Failed to load PayPal SDK');
        onError(new Error('Failed to load PayPal SDK'));
        setIsLoading(false);
      };
      
      document.head.appendChild(script);
    };

    loadPayPalScript();
  }, [clientId, onError]);

  // Initialize PayPal buttons
  useEffect(() => {
    if (!scriptLoaded || !window.paypal || !paypalRef.current || disabled) {
      return;
    }

    // Clear any existing buttons
    paypalRef.current.innerHTML = '';

    try {
      window.paypal.Buttons({
        style: {
          color: 'gold',
          shape: 'rect',
          label: 'pay',
          height: 50
        },
        
        createOrder: async () => {
          try {
            setIsProcessing(true);
            console.log('Creating PayPal order...');
            
            const { data, error } = await supabase.functions.invoke('create-paypal-order', {
              body: {
                planId,
                userId,
                amount
              }
            });

            if (error) {
              console.error('Error creating PayPal order:', error);
              throw new Error(error.message || 'Failed to create PayPal order');
            }

            console.log('PayPal order created:', data.id);
            return data.id;
          } catch (error) {
            console.error('Error in createOrder:', error);
            setIsProcessing(false);
            onError(error);
            throw error;
          }
        },

        onApprove: async (data: any) => {
          try {
            console.log('PayPal payment approved:', data);
            
            // Verify and capture the payment
            const { data: verificationData, error } = await supabase.functions.invoke('verify-paypal-payment', {
              body: {
                orderId: data.orderID,
                paymentId: data.paymentID
              }
            });

            if (error) {
              console.error('Error verifying PayPal payment:', error);
              throw new Error(error.message || 'Payment verification failed');
            }

            console.log('PayPal payment verified:', verificationData);

            // Call success handler with payment data
            onSuccess({
              paymentMethod: 'paypal',
              paymentId: data.paymentID,
              orderId: data.orderID,
              status: verificationData.status,
              details: {
                id: data.paymentID,
                status: verificationData.status,
                amount: amount
              }
            });

          } catch (error) {
            console.error('Error in onApprove:', error);
            setIsProcessing(false);
            onError(error);
          }
        },

        onCancel: (data: any) => {
          console.log('PayPal payment cancelled:', data);
          setIsProcessing(false);
          onError(new Error('Payment was cancelled'));
        },

        onError: (err: any) => {
          console.error('PayPal payment error:', err);
          setIsProcessing(false);
          onError(err);
        }
      }).render(paypalRef.current);

    } catch (error) {
      console.error('Error initializing PayPal buttons:', error);
      onError(error);
    }
  }, [scriptLoaded, disabled, amount, planId, userId, onSuccess, onError]);

  if (isLoading) {
    return (
      <Button disabled className="w-full">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading PayPal...
      </Button>
    );
  }

  if (isProcessing) {
    return (
      <Button disabled className="w-full">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Processing Payment...
      </Button>
    );
  }

  return (
    <div className="w-full">
      <div ref={paypalRef} className="min-h-[50px]" />
      {disabled && (
        <div className="absolute inset-0 bg-gray-200 bg-opacity-50 flex items-center justify-center">
          <span className="text-gray-600">Payment processing...</span>
        </div>
      )}
    </div>
  );
}
