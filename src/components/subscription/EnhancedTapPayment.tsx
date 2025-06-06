
import React, { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { tapScriptLoader } from '@/utils/tap-script-loader';
import { supabase } from "@/integrations/supabase/client";

interface EnhancedTapPaymentProps {
  amount: number;
  planName: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
  onStart?: () => void;
}

export function EnhancedTapPayment({ 
  amount, 
  planName, 
  onSuccess, 
  onError, 
  onStart 
}: EnhancedTapPaymentProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [kwdAmount, setKwdAmount] = useState<string>('');
  const { user } = useAuth();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    fetchExchangeRate();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (exchangeRate) {
      setKwdAmount((amount * exchangeRate).toFixed(3));
    }
  }, [amount, exchangeRate]);

  const fetchExchangeRate = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('exchange-rate');
      
      if (error) {
        throw new Error(`Failed to fetch exchange rate: ${error.message}`);
      }

      if (data?.usdToKwd) {
        setExchangeRate(data.usdToKwd);
      } else {
        // Fallback rate
        setExchangeRate(0.307);
      }
    } catch (error: any) {
      console.error('Exchange rate fetch error:', error);
      // Use fallback rate
      setExchangeRate(0.307);
    }
  };

  const handleTapPayment = async () => {
    if (!user) {
      setError('Please log in to continue with payment');
      return;
    }

    if (!exchangeRate) {
      setError('Exchange rate not available');
      return;
    }

    setLoading(true);
    setError(null);
    onStart?.();

    try {
      // Load Tap script
      await tapScriptLoader.loadScript();

      if (!window.Tapjsli) {
        throw new Error('Tap SDK not available');
      }

      // Get Tap configuration
      const { data: tapConfig, error: configError } = await supabase.functions.invoke('create-tap-session', {
        body: {
          amount: kwdAmount,
          planName: planName,
          currency: 'KWD'
        }
      });

      if (configError) {
        throw new Error(`Configuration error: ${configError.message}`);
      }

      if (!tapConfig?.publishableKey) {
        throw new Error('Tap payment configuration not available');
      }

      // Initialize Tap payment
      window.Tapjsli({
        publicKey: tapConfig.publishableKey,
        merchant: tapConfig.publishableKey,
        amount: kwdAmount,
        currency: 'KWD',
        customer: {
          id: user.id,
          email: user.email,
          name: user.email
        },
        onSuccess: (response: any) => {
          if (!mountedRef.current) return;
          setLoading(false);
          onSuccess({
            paymentId: response.transaction?.id || response.id,
            paymentMethod: 'tap',
            details: response
          });
        },
        onError: (error: any) => {
          if (!mountedRef.current) return;
          setLoading(false);
          setError(error.message || 'Payment failed');
          onError({
            message: error.message || 'Tap payment failed',
            code: 'TAP_ERROR'
          });
        },
        onClose: () => {
          if (!mountedRef.current) return;
          setLoading(false);
        }
      });

    } catch (error: any) {
      if (!mountedRef.current) return;
      setError(error.message || 'Failed to initialize payment');
      setLoading(false);
      onError({
        message: error.message || 'Failed to initialize Tap payment',
        code: 'INIT_ERROR'
      });
    }
  };

  const handleRetry = () => {
    setError(null);
    tapScriptLoader.reset();
    handleTapPayment();
  };

  if (!user) {
    return (
      <div className="w-full p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800 text-sm">Please log in to continue with payment</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="w-full p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm mb-3">Error: {error}</p>
          <Button size="sm" variant="outline" onClick={handleRetry}>
            Retry
          </Button>
        </div>
      )}
      
      <Button 
        className="w-full" 
        onClick={handleTapPayment}
        disabled={loading || !user || !exchangeRate}
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
      
      {exchangeRate && (
        <div className="text-center">
          <small className="text-gray-600">
            Amount: ${amount} USD ≈ {kwdAmount} KWD
          </small>
        </div>
      )}
    </div>
  );
}
