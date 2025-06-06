
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePaymentSDKLoader } from "@/hooks/usePaymentSDKLoader";
import { supabase } from "@/integrations/supabase/client";

interface PaymentProcessorProps {
  method: 'paypal' | 'tap';
  amount: number;
  planName: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
  onStart?: () => void;
  onBack: () => void;
}

export function PaymentProcessor({
  method,
  amount,
  planName,
  onSuccess,
  onError,
  onStart,
  onBack
}: PaymentProcessorProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const paymentContainerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const { user } = useAuth();
  const { loadPayPalSDK, loadTapSDK, resetPayPal, resetTap } = usePaymentSDKLoader();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (method === 'paypal') {
      initializePayPal();
    } else if (method === 'tap') {
      initializeTap();
    }
  }, [method, amount, retryCount]);

  const initializePayPal = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get PayPal configuration
      const { data: config, error: configError } = await supabase.functions.invoke('get-paypal-config');
      
      if (configError) {
        throw new Error(`Failed to get PayPal config: ${configError.message}`);
      }

      // Load PayPal SDK
      await loadPayPalSDK(config.clientId);

      // Render PayPal buttons
      if (mountedRef.current && paymentContainerRef.current && window.paypal) {
        paymentContainerRef.current.innerHTML = '';
        
        const buttons = window.paypal.Buttons({
          createOrder: (data: any, actions: any) => {
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
              const details = await actions.order.capture();
              if (mountedRef.current) {
                onSuccess({
                  paymentId: data.orderID,
                  paymentMethod: 'paypal',
                  details
                });
              }
            } catch (err: any) {
              if (mountedRef.current) {
                onError({
                  message: err.message || 'Payment capture failed',
                  code: 'CAPTURE_ERROR'
                });
              }
            }
          },
          onError: (err: any) => {
            if (mountedRef.current) {
              onError({
                message: err.message || 'PayPal payment failed',
                code: 'PAYPAL_ERROR'
              });
            }
          },
          onCancel: () => {
            if (mountedRef.current) {
              onBack();
            }
          }
        });

        await buttons.render(paymentContainerRef.current);
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err.message || 'Failed to initialize PayPal');
        setLoading(false);
      }
    }
  };

  const initializeTap = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        throw new Error('Please log in to continue with payment');
      }

      // Load Tap SDK
      await loadTapSDK();

      // Get Tap configuration
      const { data: tapConfig, error: configError } = await supabase.functions.invoke('create-tap-session', {
        body: {
          amount: amount,
          currency: 'USD',
          planName: planName
        }
      });

      if (configError) {
        throw new Error(`Configuration error: ${configError.message}`);
      }

      if (!tapConfig?.publishableKey) {
        throw new Error('Tap payment configuration not available');
      }

      // Initialize Tap payment
      if (mountedRef.current && window.Tapjsli) {
        onStart?.();
        
        window.Tapjsli({
          publicKey: tapConfig.publishableKey,
          merchant: tapConfig.publishableKey,
          amount: amount,
          currency: 'USD',
          customer: {
            id: user.id,
            email: user.email,
            name: user.email
          },
          onSuccess: (response: any) => {
            if (mountedRef.current) {
              onSuccess({
                paymentId: response.transaction?.id || response.id,
                paymentMethod: 'tap',
                details: response
              });
            }
          },
          onError: (error: any) => {
            if (mountedRef.current) {
              onError({
                message: error.message || 'Tap payment failed',
                code: 'TAP_ERROR'
              });
            }
          },
          onClose: () => {
            if (mountedRef.current) {
              setLoading(false);
            }
          }
        });

        setLoading(false);
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err.message || 'Failed to initialize Tap payment');
        setLoading(false);
      }
    }
  };

  const handleRetry = () => {
    if (retryCount >= 3) return;
    
    setRetryCount(prev => prev + 1);
    if (method === 'paypal') {
      resetPayPal();
    } else if (method === 'tap') {
      resetTap();
    }
  };

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <div>
            <p className="text-red-800 font-medium">Payment Error</p>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            Back to Methods
          </Button>
          {retryCount < 3 && (
            <Button onClick={handleRetry}>
              Retry ({retryCount + 1}/3)
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {method === 'paypal' ? 'PayPal Payment' : 'Tap Payment'}
        </h3>
        <Button variant="ghost" size="sm" onClick={onBack}>
          Change Method
        </Button>
      </div>

      <div className="p-4 border rounded-lg bg-gray-50">
        <p className="text-sm text-gray-600">
          Amount: <span className="font-semibold">${amount} USD</span>
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading payment interface...</span>
        </div>
      )}

      <div ref={paymentContainerRef} className="min-h-[200px]" />
    </div>
  );
}
