
import React, { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    paypal?: any;
  }
}

interface PayPalPaymentProps {
  amount: number;
  planName: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
}

export function PayPalPayment({ amount, planName, onSuccess, onError }: PayPalPaymentProps) {
  const paypalRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const scriptLoadedRef = useRef(false);

  const maxRetries = 3;

  const loadPayPalScript = async () => {
    if (window.paypal && scriptLoadedRef.current) {
      setReady(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Loading PayPal configuration...');
      
      const { data: config, error: configError } = await supabase.functions.invoke('get-paypal-config');

      if (configError) {
        throw new Error(`Config error: ${configError.message}`);
      }

      if (!config?.clientId) {
        throw new Error('PayPal configuration not available');
      }

      // Remove existing PayPal script if any
      const existingScript = document.querySelector('script[src*="paypal.com/sdk"]');
      if (existingScript) {
        existingScript.remove();
      }

      // Load PayPal script
      const script = document.createElement('script');
      const environment = config.environment === 'production' ? '' : '.sandbox';
      script.src = `https://www${environment}.paypal.com/sdk/js?client-id=${config.clientId}&currency=USD&intent=capture`;
      
      script.onload = () => {
        console.log('PayPal script loaded successfully');
        scriptLoadedRef.current = true;
        setReady(true);
        setLoading(false);
      };
      
      script.onerror = () => {
        console.error('Failed to load PayPal script');
        setError('Failed to load PayPal payment system');
        setLoading(false);
      };
      
      document.head.appendChild(script);
      
    } catch (error: any) {
      console.error('PayPal initialization error:', error);
      setError(error.message || 'Failed to initialize PayPal');
      setLoading(false);
    }
  };

  const renderPayPalButton = () => {
    if (!window.paypal || !paypalRef.current || paypalRef.current.hasChildNodes()) {
      return;
    }

    try {
      window.paypal.Buttons({
        createOrder: (data: any, actions: any) => {
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
            const details = await actions.order.capture();
            console.log('PayPal payment approved:', data.orderID);
            onSuccess({
              paymentId: data.orderID,
              paymentMethod: 'paypal',
              details
            });
          } catch (error) {
            console.error('PayPal capture error:', error);
            onError(error);
          }
        },
        onError: (error: any) => {
          console.error('PayPal payment error:', error);
          onError(error);
        },
        onCancel: () => {
          console.log('PayPal payment cancelled');
        }
      }).render(paypalRef.current);
    } catch (error) {
      console.error('PayPal button render error:', error);
      setError('Failed to render PayPal button');
    }
  };

  const handleRetry = () => {
    if (retryCount < maxRetries) {
      setRetryCount(prev => prev + 1);
      setError(null);
      setReady(false);
      scriptLoadedRef.current = false;
      
      // Clear PayPal reference
      if (paypalRef.current) {
        paypalRef.current.innerHTML = '';
      }
      
      loadPayPalScript();
    }
  };

  useEffect(() => {
    loadPayPalScript();
    
    return () => {
      // Cleanup on unmount
      if (paypalRef.current) {
        paypalRef.current.innerHTML = '';
      }
    };
  }, []);

  useEffect(() => {
    if (ready && window.paypal) {
      renderPayPalButton();
    }
  }, [ready, amount, planName]);

  if (loading) {
    return (
      <div className="w-full h-12 flex items-center justify-center border rounded-lg bg-gray-50">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm">Loading PayPal...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <p className="text-red-800 text-sm font-medium">PayPal Error</p>
        </div>
        <p className="text-red-700 text-sm mb-3">{error}</p>
        {retryCount < maxRetries && (
          <Button size="sm" variant="outline" onClick={handleRetry} className="flex items-center gap-2">
            <RefreshCw className="h-3 w-3" />
            Retry PayPal ({retryCount + 1}/{maxRetries})
          </Button>
        )}
        {retryCount >= maxRetries && (
          <p className="text-red-600 text-xs">Maximum retry attempts reached. Please refresh the page.</p>
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div ref={paypalRef} className="w-full min-h-[45px]" />
    </div>
  );
}
