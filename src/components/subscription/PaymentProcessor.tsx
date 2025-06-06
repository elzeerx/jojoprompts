
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
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
  const [detailedError, setDetailedError] = useState<string | null>(null);
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

  const getUserFriendlyError = (error: any, method: string): { message: string; details: string } => {
    const errorMessage = error?.message || error || 'Unknown error';
    
    if (errorMessage.includes('configuration not found') || errorMessage.includes('client ID missing')) {
      return {
        message: `${method === 'paypal' ? 'PayPal' : 'Tap'} is not properly configured. Please try the other payment method.`,
        details: 'Payment configuration missing. Contact support if this continues.'
      };
    }
    
    if (errorMessage.includes('timeout')) {
      return {
        message: `${method === 'paypal' ? 'PayPal' : 'Tap'} is taking too long to load. Please check your internet connection.`,
        details: 'Network timeout after 30 seconds'
      };
    }
    
    if (errorMessage.includes('network') || errorMessage.includes('Failed to fetch')) {
      return {
        message: 'Network connection issue. Please check your internet connection and try again.',
        details: 'Unable to connect to payment service'
      };
    }
    
    if (errorMessage.includes('Invalid') && errorMessage.includes('client ID')) {
      return {
        message: `${method === 'paypal' ? 'PayPal' : 'Tap'} configuration error. Please try the other payment method.`,
        details: 'Invalid payment configuration'
      };
    }
    
    return {
      message: `${method === 'paypal' ? 'PayPal' : 'Tap'} encountered an issue. Please try again or use the other payment method.`,
      details: errorMessage
    };
  };

  const initializePayPal = async () => {
    try {
      setLoading(true);
      setError(null);
      setDetailedError(null);

      console.log('[PayPal] Starting initialization process');

      // Get PayPal configuration
      const { data: config, error: configError } = await supabase.functions.invoke('get-paypal-config');
      
      if (configError) {
        throw new Error(`PayPal configuration error: ${configError.message}`);
      }

      if (!config?.clientId) {
        throw new Error('PayPal configuration not found - client ID missing');
      }

      console.log('[PayPal] Configuration received, loading SDK');

      // Load PayPal SDK
      await loadPayPalSDK(config.clientId);

      // Render PayPal buttons
      if (mountedRef.current && paymentContainerRef.current && window.paypal) {
        paymentContainerRef.current.innerHTML = '';
        
        console.log('[PayPal] Rendering payment buttons');
        
        const buttons = window.paypal.Buttons({
          createOrder: (data: any, actions: any) => {
            console.log('[PayPal] Creating order');
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
              console.log('[PayPal] Payment approved, capturing order');
              const details = await actions.order.capture();
              if (mountedRef.current) {
                onSuccess({
                  paymentId: data.orderID,
                  paymentMethod: 'paypal',
                  details
                });
              }
            } catch (err: any) {
              console.error('[PayPal] Capture error:', err);
              if (mountedRef.current) {
                onError({
                  message: err.message || 'Payment capture failed',
                  code: 'CAPTURE_ERROR'
                });
              }
            }
          },
          onError: (err: any) => {
            console.error('[PayPal] Payment error:', err);
            if (mountedRef.current) {
              onError({
                message: err.message || 'PayPal payment failed',
                code: 'PAYPAL_ERROR'
              });
            }
          },
          onCancel: () => {
            console.log('[PayPal] Payment cancelled by user');
            if (mountedRef.current) {
              onBack();
            }
          }
        });

        await buttons.render(paymentContainerRef.current);
        console.log('[PayPal] Buttons rendered successfully');
        
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    } catch (err: any) {
      console.error('[PayPal] Initialization error:', err);
      if (mountedRef.current) {
        const { message, details } = getUserFriendlyError(err, 'paypal');
        setError(message);
        setDetailedError(details);
        setLoading(false);
      }
    }
  };

  const initializeTap = async () => {
    try {
      setLoading(true);
      setError(null);
      setDetailedError(null);

      if (!user) {
        throw new Error('Please log in to continue with payment');
      }

      console.log('[Tap] Starting initialization process');

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
        throw new Error(`Tap configuration error: ${configError.message}`);
      }

      if (!tapConfig?.publishableKey) {
        throw new Error('Tap payment configuration not available');
      }

      console.log('[Tap] Configuration received, initializing payment');

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
            console.log('[Tap] Payment successful:', response);
            if (mountedRef.current) {
              onSuccess({
                paymentId: response.transaction?.id || response.id,
                paymentMethod: 'tap',
                details: response
              });
            }
          },
          onError: (error: any) => {
            console.error('[Tap] Payment error:', error);
            if (mountedRef.current) {
              onError({
                message: error.message || 'Tap payment failed',
                code: 'TAP_ERROR'
              });
            }
          },
          onClose: () => {
            console.log('[Tap] Payment dialog closed');
            if (mountedRef.current) {
              setLoading(false);
            }
          }
        });

        setLoading(false);
      }
    } catch (err: any) {
      console.error('[Tap] Initialization error:', err);
      if (mountedRef.current) {
        const { message, details } = getUserFriendlyError(err, 'tap');
        setError(message);
        setDetailedError(details);
        setLoading(false);
      }
    }
  };

  const handleRetry = () => {
    if (retryCount >= 3) return;
    
    console.log(`[${method}] Retry attempt ${retryCount + 1}/3`);
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
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-800 font-medium">{error}</p>
            {detailedError && (
              <p className="text-red-700 text-sm mt-1">{detailedError}</p>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            Back to Methods
          </Button>
          {retryCount < 3 && (
            <Button onClick={handleRetry} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
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
          <span>Loading {method === 'paypal' ? 'PayPal' : 'Tap'} payment interface...</span>
        </div>
      )}

      <div ref={paymentContainerRef} className="min-h-[200px]" />
    </div>
  );
}
