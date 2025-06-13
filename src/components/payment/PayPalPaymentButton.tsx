
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
  const [error, setError] = useState<string | null>(null);

  // Get PayPal client ID
  useEffect(() => {
    const getPayPalClientId = async () => {
      try {
        console.log('Getting PayPal client ID...');
        const { data, error } = await supabase.functions.invoke('get-paypal-client-id');
        
        if (error) {
          console.error('Failed to get PayPal client ID:', error);
          setError('Failed to initialize PayPal');
          return;
        }
        
        console.log('PayPal client ID received');
        setClientId(data.clientId);
      } catch (error) {
        console.error('Error getting PayPal client ID:', error);
        setError('Failed to initialize PayPal');
      }
    };

    getPayPalClientId();
  }, []);

  // Load PayPal SDK
  useEffect(() => {
    if (!clientId || error) return;

    const loadPayPalScript = () => {
      if (window.paypal) {
        console.log('PayPal SDK already loaded');
        setScriptLoaded(true);
        setIsLoading(false);
        return;
      }

      console.log('Loading PayPal SDK with client ID:', clientId);
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&components=buttons`;
      script.onload = () => {
        console.log('PayPal SDK loaded successfully');
        setScriptLoaded(true);
        setIsLoading(false);
      };
      script.onerror = () => {
        console.error('Failed to load PayPal SDK');
        setError('Failed to load PayPal SDK');
        setIsLoading(false);
      };
      
      document.head.appendChild(script);
    };

    loadPayPalScript();
  }, [clientId, error]);

  // Initialize PayPal buttons
  useEffect(() => {
    if (!scriptLoaded || !window.paypal || !paypalRef.current || disabled || error) {
      return;
    }

    console.log('Initializing PayPal buttons...');
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
            console.log('Creating PayPal order via edge function...');
            
            const { data, error } = await supabase.functions.invoke('create-paypal-order', {
              body: {
                planId,
                userId,
                amount
              }
            });

            console.log('Create order response:', { data, error });

            if (error) {
              console.error('Error creating PayPal order:', error);
              throw new Error(error.message || 'Failed to create PayPal order');
            }

            if (!data || !data.success || !data.id) {
              console.error('Invalid order response:', data);
              throw new Error(data?.error || 'Invalid order response from server');
            }

            console.log('PayPal order created successfully:', data.id);
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
            console.log('PayPal payment approved, capturing payment...', data);
            
            // Capture the payment using our edge function
            const { data: captureData, error: captureError } = await supabase.functions.invoke('capture-paypal-payment', {
              body: {
                orderId: data.orderID,
                planId,
                userId
              }
            });

            console.log('Capture response:', { captureData, captureError });

            if (captureError) {
              console.error('Error capturing payment:', captureError);
              throw new Error(captureError.message || 'Failed to capture payment');
            }

            if (!captureData || !captureData.success) {
              console.error('Payment capture failed:', captureData);
              throw new Error(captureData?.error || 'Payment capture was unsuccessful');
            }

            console.log('Payment captured successfully:', captureData);

            // Call success handler with captured payment data
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
      setError('Failed to initialize PayPal buttons');
    }
  }, [scriptLoaded, disabled, amount, planId, userId, onSuccess, onError, error]);

  if (error) {
    return (
      <div className="w-full p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800 text-sm">{error}</p>
        <Button 
          variant="outline" 
          className="mt-2 w-full" 
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    );
  }

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
