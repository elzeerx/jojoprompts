
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { paypalScriptLoader } from '@/utils/paypal-script-loader';
import { supabase } from "@/integrations/supabase/client";

interface EnhancedPayPalPaymentProps {
  amount: number;
  planName: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
  onStart?: () => void;
  onCancel?: (data: any) => void;
}

export function EnhancedPayPalPayment({ 
  amount, 
  planName, 
  onSuccess, 
  onError, 
  onStart,
  onCancel 
}: EnhancedPayPalPaymentProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const paypalRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const renderAttemptRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadPayPal = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get client ID from edge function
      const { data: config, error: configError } = await supabase.functions.invoke('get-paypal-config');

      if (configError) {
        throw new Error(`Failed to fetch PayPal configuration: ${configError.message}`);
      }

      if (!config?.clientId) {
        throw new Error('PayPal configuration not available');
      }
      
      // Load PayPal script
      await paypalScriptLoader.loadScript(config.clientId, config.currency || 'USD');

      // Render PayPal buttons if component is still mounted
      if (mountedRef.current && paypalRef.current && window.paypal) {
        await renderPayPalButtons();
      }
    } catch (err: any) {
      console.error('PayPal loading error:', err);
      if (mountedRef.current) {
        setError(err.message);
        setLoading(false);
      }
    }
  }, [amount, planName]);

  const renderPayPalButtons = async () => {
    try {
      // Clear existing buttons
      if (paypalRef.current) {
        paypalRef.current.innerHTML = '';
      }

      renderAttemptRef.current += 1;
      const currentAttempt = renderAttemptRef.current;

      const buttons = window.paypal.Buttons({
        createOrder: async (data: any, actions: any) => {
          try {
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
          } catch (err: any) {
            console.error('Create order error:', err);
            throw err;
          }
        },
        onApprove: async (data: any, actions: any) => {
          try {
            const details = await actions.order.capture();
            if (mountedRef.current) {
              onSuccess({
                paymentId: data.orderID,
                paymentMethod: 'paypal',
                details
              });
            }
          } catch (err: any) {
            console.error('Capture payment error:', err);
            if (mountedRef.current) {
              onError({
                message: err.message || 'Payment capture failed',
                code: 'CAPTURE_ERROR'
              });
            }
          }
        },
        onError: (err: any) => {
          console.error('PayPal error:', err);
          if (mountedRef.current) {
            onError({
              message: err.message || 'PayPal payment failed',
              code: 'PAYPAL_ERROR'
            });
          }
        },
        onCancel: (data: any) => {
          if (mountedRef.current) {
            onCancel?.(data);
          }
        }
      });

      // Only render if this is still the latest attempt
      if (currentAttempt === renderAttemptRef.current && paypalRef.current) {
        await buttons.render(paypalRef.current);
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    } catch (err: any) {
      console.error('PayPal button render error:', err);
      if (mountedRef.current) {
        setError('Failed to render PayPal buttons');
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadPayPal();
  }, [loadPayPal]);

  const handleRetry = () => {
    if (retryCount >= 3) return;
    
    setRetryCount(prev => prev + 1);
    paypalScriptLoader.reset();
    loadPayPal();
  };

  if (error) {
    return (
      <div className="w-full p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800 text-sm mb-3">Error loading PayPal: {error}</p>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={handleRetry} 
          disabled={retryCount >= 3}
          className="flex items-center gap-2"
        >
          {retryCount >= 3 ? 'Max retries reached' : `Retry (${retryCount + 1}/3)`}
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full">
      {loading && (
        <div className="w-full h-12 flex items-center justify-center border rounded-lg bg-gray-50">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span className="text-sm">Loading PayPal...</span>
        </div>
      )}
      <div ref={paypalRef} className="w-full min-h-[45px]" />
    </div>
  );
}
