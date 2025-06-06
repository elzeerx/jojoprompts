
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
  onStart?: () => void;
  onUnavailable?: (reason: string) => void;
}

export function PayPalPayment({ 
  amount, 
  planName, 
  onSuccess, 
  onError, 
  onStart,
  onUnavailable 
}: PayPalPaymentProps) {
  const paypalRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const scriptLoadedRef = useRef(false);
  const componentMountedRef = useRef(true);

  const maxRetries = 3;

  const logPayPalEvent = (event: string, data?: any) => {
    console.log(`[PayPal Payment] ${event}:`, {
      amount,
      planName,
      timestamp: new Date().toISOString(),
      ...data
    });
  };

  const loadPayPalScript = async () => {
    if (window.paypal && scriptLoadedRef.current) {
      setReady(true);
      return;
    }

    if (!componentMountedRef.current) return;

    setLoading(true);
    setError(null);
    logPayPalEvent('Script Loading Started');

    try {
      const { data: config, error: configError } = await supabase.functions.invoke('get-paypal-config');

      if (!componentMountedRef.current) return;

      if (configError) {
        throw new Error(`Configuration error: ${configError.message}`);
      }

      if (!config?.clientId) {
        const errorMessage = 'PayPal configuration not available';
        logPayPalEvent('Configuration Error', { error: errorMessage });
        onUnavailable?.(errorMessage);
        throw new Error(errorMessage);
      }

      // Remove existing PayPal script if any
      const existingScript = document.querySelector('script[src*="paypal.com/sdk"]');
      if (existingScript) {
        existingScript.remove();
        logPayPalEvent('Existing Script Removed');
      }

      // Load PayPal script
      const script = document.createElement('script');
      const environment = config.environment === 'production' ? '' : '.sandbox';
      script.src = `https://www${environment}.paypal.com/sdk/js?client-id=${config.clientId}&currency=USD&intent=capture`;
      
      script.onload = () => {
        if (!componentMountedRef.current) return;
        logPayPalEvent('Script Loaded Successfully');
        scriptLoadedRef.current = true;
        setReady(true);
        setLoading(false);
      };
      
      script.onerror = () => {
        if (!componentMountedRef.current) return;
        const errorMessage = 'Failed to load PayPal payment system';
        logPayPalEvent('Script Load Error', { error: errorMessage });
        setError(errorMessage);
        setLoading(false);
        onUnavailable?.(errorMessage);
      };
      
      document.head.appendChild(script);
      
    } catch (error: any) {
      if (!componentMountedRef.current) return;
      logPayPalEvent('Initialization Error', { error: error.message });
      setError(error.message || 'Failed to initialize PayPal');
      setLoading(false);
    }
  };

  const renderPayPalButton = () => {
    if (!window.paypal || !paypalRef.current || paypalRef.current.hasChildNodes() || !componentMountedRef.current) {
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
      setError('Failed to render PayPal button');
      onError({
        message: 'Failed to render PayPal button',
        code: 'RENDER_ERROR',
        critical: true
      });
    }
  };

  const handleRetry = () => {
    if (retryCount < maxRetries && componentMountedRef.current) {
      logPayPalEvent('Retry Attempted', { attempt: retryCount + 1 });
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
    componentMountedRef.current = true;
    loadPayPalScript();
    
    return () => {
      componentMountedRef.current = false;
      logPayPalEvent('Component Unmounted');
      // Cleanup on unmount
      if (paypalRef.current) {
        paypalRef.current.innerHTML = '';
      }
    };
  }, []);

  useEffect(() => {
    if (ready && window.paypal && componentMountedRef.current) {
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
