
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

declare global {
  interface Window {
    Tapjsli?: any;
  }
}

interface TapPaymentProps {
  amount: number;
  planName: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
  onStart?: () => void;
  onUnavailable?: (reason: string) => void;
}

export function TapPayment({ 
  amount, 
  planName, 
  onSuccess, 
  onError,
  onStart,
  onUnavailable 
}: TapPaymentProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const componentMountedRef = useRef(true);

  const maxRetries = 3;
  const USD_TO_KWD_RATE = 0.307; // Fixed conversion rate

  const logTapEvent = (event: string, data?: any) => {
    console.log(`[Tap Payment] ${event}:`, {
      amount,
      planName,
      userEmail: user?.email,
      timestamp: new Date().toISOString(),
      ...data
    });
  };

  useEffect(() => {
    componentMountedRef.current = true;
    return () => {
      componentMountedRef.current = false;
      logTapEvent('Component Unmounted');
    };
  }, []);

  const loadTapScript = async (): Promise<void> => {
    if (window.Tapjsli) {
      logTapEvent('Script Already Loaded');
      return;
    }

    logTapEvent('Script Loading Started');
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://tap.company/js/pay.js';
      
      script.onload = () => {
        if (!componentMountedRef.current) return;
        logTapEvent('Script Loaded Successfully');
        resolve();
      };
      
      script.onerror = () => {
        if (!componentMountedRef.current) return;
        const errorMessage = 'Failed to load Tap payment system';
        logTapEvent('Script Load Error', { error: errorMessage });
        reject(new Error(errorMessage));
      };
      
      document.head.appendChild(script);
    });
  };

  const handleTapPayment = async () => {
    if (!user) {
      const errorMessage = 'Authentication required for Tap payment';
      logTapEvent('Authentication Error', { error: errorMessage });
      toast({
        title: "Authentication Required",
        description: "Please log in to continue with payment",
        variant: "destructive"
      });
      return;
    }

    if (!componentMountedRef.current) return;

    setLoading(true);
    setError(null);
    onStart?.();
    logTapEvent('Payment Process Started');

    try {
      // Load Tap script first
      await loadTapScript();

      if (!componentMountedRef.current) return;

      // Get Tap configuration
      logTapEvent('Fetching Configuration');
      const { data: config, error: configError } = await supabase.functions.invoke('create-tap-session', {
        body: {
          amount: amount * USD_TO_KWD_RATE,
          planName,
          currency: 'KWD'
        }
      });

      if (!componentMountedRef.current) return;

      if (configError) {
        throw new Error(`Configuration error: ${configError.message}`);
      }

      if (!config?.publishableKey) {
        const errorMessage = 'Tap payment configuration not available';
        logTapEvent('Configuration Error', { error: errorMessage });
        onUnavailable?.(errorMessage);
        throw new Error(errorMessage);
      }

      logTapEvent('Configuration Received', { 
        amount: config.amount,
        currency: config.currency 
      });

      // Initialize Tap payment
      logTapEvent('Initializing Tap Payment Dialog');
      window.Tapjsli({
        publicKey: config.publishableKey,
        merchant: config.publishableKey,
        amount: config.amount,
        currency: 'KWD',
        customer: {
          id: user.id,
          email: user.email,
          name: user.email
        },
        onSuccess: (response: any) => {
          if (!componentMountedRef.current) return;
          logTapEvent('Payment Success', { 
            transactionId: response.transaction?.id || response.id,
            status: response.status 
          });
          setLoading(false);
          onSuccess({
            paymentId: response.transaction?.id || response.id,
            paymentMethod: 'tap',
            details: response
          });
        },
        onError: (error: any) => {
          if (!componentMountedRef.current) return;
          logTapEvent('Payment Error', { error: error.message || error });
          setLoading(false);
          setError(error.message || 'Payment failed');
          onError({
            message: error.message || 'Tap payment failed',
            code: 'TAP_ERROR'
          });
        },
        onClose: () => {
          if (!componentMountedRef.current) return;
          logTapEvent('Payment Dialog Closed');
          setLoading(false);
        }
      });

    } catch (error: any) {
      if (!componentMountedRef.current) return;
      logTapEvent('Payment Process Error', { error: error.message });
      setError(error.message || 'Failed to initialize payment');
      setLoading(false);
      onError({
        message: error.message || 'Failed to initialize Tap payment',
        code: 'INIT_ERROR'
      });
    }
  };

  const handleRetry = () => {
    if (retryCount < maxRetries && componentMountedRef.current) {
      logTapEvent('Retry Attempted', { attempt: retryCount + 1 });
      setRetryCount(prev => prev + 1);
      setError(null);
      handleTapPayment();
    }
  };

  const kwdAmount = (amount * USD_TO_KWD_RATE).toFixed(2);

  return (
    <div className="space-y-3">
      {error && (
        <div className="w-full p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <p className="text-red-800 text-sm font-medium">Tap Payment Error</p>
          </div>
          <p className="text-red-700 text-sm mb-3">{error}</p>
          {retryCount < maxRetries && (
            <Button size="sm" variant="outline" onClick={handleRetry} className="flex items-center gap-2">
              <RefreshCw className="h-3 w-3" />
              Retry Payment ({retryCount + 1}/{maxRetries})
            </Button>
          )}
          {retryCount >= maxRetries && (
            <p className="text-red-600 text-xs">Maximum retry attempts reached. Please try again later.</p>
          )}
        </div>
      )}
      
      <Button 
        className="w-full" 
        onClick={handleTapPayment}
        disabled={loading || !user}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing Payment...
          </>
        ) : (
          `Pay with Tap (${kwdAmount} KWD)`
        )}
      </Button>
      
      {!user && (
        <p className="text-xs text-red-600 text-center">
          Please log in to use Tap payment
        </p>
      )}
    </div>
  );
}
