
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
  const [debugInfo, setDebugInfo] = useState<any>(null);
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

  const logDebugInfo = (info: any) => {
    console.log('[Payment Debug]', info);
    setDebugInfo(info);
  };

  const getUserFriendlyError = (error: any, method: string): { message: string; details: string } => {
    const errorMessage = error?.message || error || 'Unknown error';
    
    // Check for specific error patterns
    if (errorMessage.includes('NetworkError') || errorMessage.includes('fetch')) {
      return {
        message: `Failed to connect to ${method === 'paypal' ? 'PayPal' : 'Tap'} servers. Please check your internet connection.`,
        details: 'Network request failed - check internet connection'
      };
    }
    
    if (errorMessage.includes('CORS') || errorMessage.includes('cross-origin')) {
      return {
        message: `${method === 'paypal' ? 'PayPal' : 'Tap'} service configuration issue. Please try again later.`,
        details: 'CORS policy error - server configuration issue'
      };
    }
    
    if (errorMessage.includes('FunctionsError') || errorMessage.includes('Edge Function')) {
      return {
        message: `Payment service is temporarily unavailable. Please try again.`,
        details: 'Edge function error - backend service issue'
      };
    }
    
    if (errorMessage.includes('timeout')) {
      return {
        message: `${method === 'paypal' ? 'PayPal' : 'Tap'} is taking too long to respond. Please try again.`,
        details: 'Request timeout after 30 seconds'
      };
    }
    
    if (errorMessage.includes('configuration not found') || errorMessage.includes('client ID missing')) {
      return {
        message: `${method === 'paypal' ? 'PayPal' : 'Tap'} is not properly configured. Please contact support.`,
        details: 'Payment service configuration missing'
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
      setDebugInfo(null);

      logDebugInfo({ step: 'paypal_init_start', amount, planName });

      // Test network connectivity first
      try {
        const testResponse = await fetch('https://httpbin.org/get', { method: 'GET' });
        if (!testResponse.ok) {
          throw new Error('Network connectivity test failed');
        }
        logDebugInfo({ step: 'network_test', status: 'passed' });
      } catch (networkError) {
        logDebugInfo({ step: 'network_test', status: 'failed', error: networkError });
        throw new Error('No internet connection. Please check your network and try again.');
      }

      // Get PayPal configuration with detailed error handling
      logDebugInfo({ step: 'fetching_paypal_config' });
      
      const { data: config, error: configError } = await supabase.functions.invoke('get-paypal-config', {
        headers: {
          'Content-Type': 'application/json',
        }
      });

      logDebugInfo({ 
        step: 'paypal_config_response', 
        hasData: !!config, 
        hasError: !!configError,
        errorDetails: configError 
      });

      if (!mountedRef.current) return;

      if (configError) {
        logDebugInfo({ step: 'config_error', error: configError });
        throw new Error(`PayPal configuration error: ${configError.message || 'Unknown configuration error'}`);
      }

      if (!config?.clientId) {
        logDebugInfo({ step: 'missing_client_id', config });
        throw new Error('PayPal configuration not available - missing client ID');
      }

      logDebugInfo({ step: 'paypal_config_success', environment: config.environment });

      // Load PayPal SDK
      await loadPayPalSDK(config.clientId);

      // Render PayPal buttons
      if (mountedRef.current && paymentContainerRef.current && window.paypal) {
        paymentContainerRef.current.innerHTML = '';
        
        logDebugInfo({ step: 'rendering_paypal_buttons' });
        
        const buttons = window.paypal.Buttons({
          createOrder: (data: any, actions: any) => {
            logDebugInfo({ step: 'creating_paypal_order' });
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
              logDebugInfo({ step: 'paypal_payment_approved', orderID: data.orderID });
              const details = await actions.order.capture();
              if (mountedRef.current) {
                onSuccess({
                  paymentId: data.orderID,
                  paymentMethod: 'paypal',
                  details
                });
              }
            } catch (err: any) {
              logDebugInfo({ step: 'paypal_capture_error', error: err });
              if (mountedRef.current) {
                onError({
                  message: err.message || 'Payment capture failed',
                  code: 'CAPTURE_ERROR'
                });
              }
            }
          },
          onError: (err: any) => {
            logDebugInfo({ step: 'paypal_payment_error', error: err });
            if (mountedRef.current) {
              onError({
                message: err.message || 'PayPal payment failed',
                code: 'PAYPAL_ERROR'
              });
            }
          },
          onCancel: () => {
            logDebugInfo({ step: 'paypal_payment_cancelled' });
            if (mountedRef.current) {
              onBack();
            }
          }
        });

        await buttons.render(paymentContainerRef.current);
        logDebugInfo({ step: 'paypal_buttons_rendered' });
        
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    } catch (err: any) {
      logDebugInfo({ step: 'paypal_init_error', error: err });
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
      setDebugInfo(null);

      if (!user) {
        throw new Error('Please log in to continue with payment');
      }

      logDebugInfo({ step: 'tap_init_start', amount, planName, userId: user.id });

      // Test network connectivity first
      try {
        const testResponse = await fetch('https://httpbin.org/get', { method: 'GET' });
        if (!testResponse.ok) {
          throw new Error('Network connectivity test failed');
        }
        logDebugInfo({ step: 'network_test', status: 'passed' });
      } catch (networkError) {
        logDebugInfo({ step: 'network_test', status: 'failed', error: networkError });
        throw new Error('No internet connection. Please check your network and try again.');
      }

      // Load Tap SDK
      await loadTapSDK();

      // Get Tap configuration
      logDebugInfo({ step: 'fetching_tap_config' });
      
      const { data: tapConfig, error: configError } = await supabase.functions.invoke('create-tap-session', {
        body: {
          amount: amount,
          currency: 'USD',
          planName: planName
        }
      });

      logDebugInfo({ 
        step: 'tap_config_response', 
        hasData: !!tapConfig, 
        hasError: !!configError,
        errorDetails: configError 
      });

      if (configError) {
        logDebugInfo({ step: 'tap_config_error', error: configError });
        throw new Error(`Tap configuration error: ${configError.message || 'Unknown configuration error'}`);
      }

      if (!tapConfig?.publishableKey) {
        logDebugInfo({ step: 'missing_publishable_key', config: tapConfig });
        throw new Error('Tap payment configuration not available');
      }

      logDebugInfo({ step: 'tap_config_success' });

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
            logDebugInfo({ step: 'tap_payment_success', response });
            if (mountedRef.current) {
              onSuccess({
                paymentId: response.transaction?.id || response.id,
                paymentMethod: 'tap',
                details: response
              });
            }
          },
          onError: (error: any) => {
            logDebugInfo({ step: 'tap_payment_error', error });
            if (mountedRef.current) {
              onError({
                message: error.message || 'Tap payment failed',
                code: 'TAP_ERROR'
              });
            }
          },
          onClose: () => {
            logDebugInfo({ step: 'tap_payment_closed' });
            if (mountedRef.current) {
              setLoading(false);
            }
          }
        });

        setLoading(false);
      }
    } catch (err: any) {
      logDebugInfo({ step: 'tap_init_error', error: err });
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
    
    logDebugInfo({ step: 'manual_retry', attempt: retryCount + 1, method });
    setRetryCount(prev => prev + 1);
    
    if (method === 'paypal') {
      resetPayPal();
    } else if (method === 'tap') {
      resetTap();
    }
  };

  const handleDiagnose = async () => {
    logDebugInfo({ step: 'running_diagnostics' });
    
    try {
      // Test basic connectivity
      const connectivityTest = await fetch('https://httpbin.org/get');
      logDebugInfo({ connectivity: connectivityTest.ok });

      // Test Supabase connection
      const { data: testData } = await supabase.from('profiles').select('id').limit(1);
      logDebugInfo({ supabase_connection: !!testData });

      // Test edge function endpoints
      if (method === 'paypal') {
        const { data, error } = await supabase.functions.invoke('get-paypal-config');
        logDebugInfo({ paypal_config_test: { hasData: !!data, error } });
      } else {
        const { data, error } = await supabase.functions.invoke('create-tap-session', {
          body: { amount: 1, planName: 'test', currency: 'USD' }
        });
        logDebugInfo({ tap_config_test: { hasData: !!data, error } });
      }
    } catch (diagError) {
      logDebugInfo({ diagnostic_error: diagError });
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
            {debugInfo && (
              <details className="mt-2">
                <summary className="text-xs text-red-600 cursor-pointer">Debug Info</summary>
                <pre className="text-xs text-red-600 mt-1 bg-red-100 p-2 rounded overflow-auto">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={onBack}>
            Back to Methods
          </Button>
          {retryCount < 3 && (
            <Button onClick={handleRetry} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry ({retryCount + 1}/3)
            </Button>
          )}
          <Button variant="outline" onClick={handleDiagnose} className="flex items-center gap-2">
            🔍 Diagnose
          </Button>
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
      
      {debugInfo && (
        <details className="mt-4">
          <summary className="text-xs text-gray-600 cursor-pointer">Debug Information</summary>
          <pre className="text-xs text-gray-600 mt-1 bg-gray-100 p-2 rounded overflow-auto max-h-40">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
