
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";
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
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  // Get PayPal client ID
  useEffect(() => {
    const getPayPalClientId = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-paypal-client-id');
        
        if (error) {
          console.error('[PayPal] Failed to get client ID:', error);
          setError('Failed to initialize PayPal payment system');
          return;
        }
        
        setClientId(data.clientId);
      } catch (error) {
        console.error('[PayPal] Error getting client ID:', error);
        setError('Payment system unavailable');
      }
    };

    getPayPalClientId();
  }, []);

  // Load PayPal SDK
  useEffect(() => {
    if (!clientId || error) return;

    const loadPayPalScript = () => {
      if (window.paypal) {
        setIsLoading(false);
        return;
      }

      // Remove any existing PayPal scripts
      const existingScripts = document.querySelectorAll('script[src*="paypal.com/sdk"]');
      existingScripts.forEach(script => script.remove());

      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=capture`;
      script.async = true;
      
      script.onload = () => {
        if (window.paypal) {
          setIsLoading(false);
        } else {
          setError('PayPal SDK failed to initialize');
        }
      };
      
      script.onerror = () => {
        setError('Failed to load PayPal payment system');
        setIsLoading(false);
      };
      
      document.head.appendChild(script);
    };

    loadPayPalScript();
  }, [clientId, error]);

  // Initialize PayPal buttons
  useEffect(() => {
    if (!window.paypal || !paypalRef.current || disabled || error || isLoading) {
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
      setError('Unable to initialize PayPal payment buttons');
    });
  }, [window.paypal, disabled, amount, planId, userId, onSuccess, onError, error, isLoading]);

  if (error) {
    return (
      <div className="w-full p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-red-800 font-medium">Payment System Error</p>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          className="w-full mt-3" 
          onClick={() => window.location.reload()}
        >
          Retry Payment Setup
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <span className="text-gray-700">Setting up PayPal payment...</span>
        </div>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="w-full p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <span className="text-blue-700 font-medium">Processing your payment...</span>
        </div>
        <p className="text-blue-600 text-sm text-center mt-2">
          Please do not close this window
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div ref={paypalRef} className="min-h-[50px]" />
      <div className="text-xs text-gray-500 text-center mt-2">
        <p>🔒 Secure payment powered by PayPal</p>
      </div>
    </div>
  );
}
