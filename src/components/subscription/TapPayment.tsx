
import React, { useState } from "react";
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
}

export function TapPayment({ amount, planName, onSuccess, onError }: TapPaymentProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const maxRetries = 3;
  const USD_TO_KWD_RATE = 0.307; // Fixed conversion rate

  const loadTapScript = async (): Promise<void> => {
    if (window.Tapjsli) {
      return;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://tap.company/js/pay.js';
      
      script.onload = () => {
        console.log('Tap script loaded successfully');
        resolve();
      };
      
      script.onerror = () => {
        console.error('Failed to load Tap script');
        reject(new Error('Failed to load Tap payment system'));
      };
      
      document.head.appendChild(script);
    });
  };

  const handleTapPayment = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to continue with payment",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Initializing Tap payment...');

      // Load Tap script first
      await loadTapScript();

      // Get Tap configuration
      const { data: config, error: configError } = await supabase.functions.invoke('create-tap-session', {
        body: {
          amount: amount * USD_TO_KWD_RATE,
          planName,
          currency: 'KWD'
        }
      });

      if (configError) {
        throw new Error(`Configuration error: ${configError.message}`);
      }

      if (!config?.publishableKey) {
        throw new Error('Tap payment configuration not available');
      }

      console.log('Tap configuration received, initializing payment...');

      // Initialize Tap payment
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
          console.log('Tap payment success:', response);
          setLoading(false);
          onSuccess({
            paymentId: response.transaction?.id || response.id,
            paymentMethod: 'tap',
            details: response
          });
        },
        onError: (error: any) => {
          console.error('Tap payment error:', error);
          setLoading(false);
          setError(error.message || 'Payment failed');
          onError(error);
        },
        onClose: () => {
          console.log('Tap payment dialog closed');
          setLoading(false);
        }
      });

    } catch (error: any) {
      console.error('Tap payment initialization error:', error);
      setError(error.message || 'Failed to initialize payment');
      setLoading(false);
      onError(error);
    }
  };

  const handleRetry = () => {
    if (retryCount < maxRetries) {
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
