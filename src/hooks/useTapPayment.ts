
import { useState } from 'react';
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useTapScriptLoader } from './useTapScriptLoader';

interface TapPaymentConfig {
  amount: number;
  planName: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
  onStart?: () => void;
  onUnavailable?: (reason: string) => void;
}

export function useTapPayment(config: TapPaymentConfig) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { loadTapScript, isComponentMounted, logTapEvent } = useTapScriptLoader();

  const maxRetries = 3;
  const USD_TO_KWD_RATE = 0.307;

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

    if (!isComponentMounted()) return;

    setLoading(true);
    setError(null);
    config.onStart?.();
    logTapEvent('Payment Process Started', {
      amount: config.amount,
      planName: config.planName,
      userEmail: user?.email
    });

    try {
      // Load Tap script first
      await loadTapScript();

      if (!isComponentMounted()) return;

      // Get Tap configuration
      logTapEvent('Fetching Configuration');
      const { data: tapConfig, error: configError } = await supabase.functions.invoke('create-tap-session', {
        body: {
          amount: config.amount * USD_TO_KWD_RATE,
          planName: config.planName,
          currency: 'KWD'
        }
      });

      if (!isComponentMounted()) return;

      if (configError) {
        throw new Error(`Configuration error: ${configError.message}`);
      }

      if (!tapConfig?.publishableKey) {
        const errorMessage = 'Tap payment configuration not available';
        logTapEvent('Configuration Error', { error: errorMessage });
        config.onUnavailable?.(errorMessage);
        throw new Error(errorMessage);
      }

      logTapEvent('Configuration Received', { 
        amount: tapConfig.amount,
        currency: tapConfig.currency 
      });

      // Initialize Tap payment
      logTapEvent('Initializing Tap Payment Dialog');
      window.Tapjsli({
        publicKey: tapConfig.publishableKey,
        merchant: tapConfig.publishableKey,
        amount: tapConfig.amount,
        currency: 'KWD',
        customer: {
          id: user.id,
          email: user.email,
          name: user.email
        },
        onSuccess: (response: any) => {
          if (!isComponentMounted()) return;
          logTapEvent('Payment Success', { 
            transactionId: response.transaction?.id || response.id,
            status: response.status 
          });
          setLoading(false);
          config.onSuccess({
            paymentId: response.transaction?.id || response.id,
            paymentMethod: 'tap',
            details: response
          });
        },
        onError: (error: any) => {
          if (!isComponentMounted()) return;
          logTapEvent('Payment Error', { error: error.message || error });
          setLoading(false);
          setError(error.message || 'Payment failed');
          config.onError({
            message: error.message || 'Tap payment failed',
            code: 'TAP_ERROR'
          });
        },
        onClose: () => {
          if (!isComponentMounted()) return;
          logTapEvent('Payment Dialog Closed');
          setLoading(false);
        }
      });

    } catch (error: any) {
      if (!isComponentMounted()) return;
      logTapEvent('Payment Process Error', { error: error.message });
      setError(error.message || 'Failed to initialize payment');
      setLoading(false);
      config.onError({
        message: error.message || 'Failed to initialize Tap payment',
        code: 'INIT_ERROR'
      });
    }
  };

  const handleRetry = () => {
    if (retryCount < maxRetries && isComponentMounted()) {
      logTapEvent('Retry Attempted', { attempt: retryCount + 1 });
      setRetryCount(prev => prev + 1);
      setError(null);
      handleTapPayment();
    }
  };

  const kwdAmount = (config.amount * USD_TO_KWD_RATE).toFixed(2);

  return {
    loading,
    error,
    retryCount,
    maxRetries,
    kwdAmount,
    handleTapPayment,
    handleRetry
  };
}
