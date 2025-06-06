
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

declare global {
  interface Window {
    paypal?: any;
    Tapjsli?: any;
  }
}

interface SimplePaymentMethodsProps {
  amount: number;
  planName: string;
  onSuccess: (paymentData: any) => void;
  onError?: (error: any) => void;
}

export function SimplePaymentMethods({ amount, planName, onSuccess, onError }: SimplePaymentMethodsProps) {
  const { user } = useAuth();
  const paypalRef = useRef<HTMLDivElement>(null);
  
  // PayPal states
  const [paypalLoading, setPaypalLoading] = useState(false);
  const [paypalError, setPaypalError] = useState<string | null>(null);
  const [paypalReady, setPaypalReady] = useState(false);
  
  // Tap states
  const [tapLoading, setTapLoading] = useState(false);
  const [tapError, setTapError] = useState<string | null>(null);

  // Load PayPal script
  const loadPayPalScript = async () => {
    if (window.paypal) {
      setPaypalReady(true);
      return;
    }

    setPaypalLoading(true);
    setPaypalError(null);

    try {
      // Direct fetch to get PayPal config
      const response = await fetch(`https://fxkqgjakbyrxkmevkglv.supabase.co/functions/v1/get-paypal-config`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4a3FnamFrYnlyeGttZXZrZ2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ4ODY4NjksImV4cCI6MjA2MDQ2Mjg2OX0.u4O7nvVrW6HZjZj058T9kKpEfa5BsyWT0i_p4UxcZi4`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4a3FnamFrYnlyeGttZXZrZ2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ4ODY4NjksImV4cCI6MjA2MDQ2Mjg2OX0.u4O7nvVrW6HZjZj058T9kKpEfa5BsyWT0i_p4UxcZi4'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get PayPal config');
      }

      const config = await response.json();
      
      // Load PayPal script
      const script = document.createElement('script');
      const environment = config.environment === 'production' ? '' : '.sandbox';
      script.src = `https://www${environment}.paypal.com/sdk/js?client-id=${config.clientId}&currency=USD&intent=capture`;
      
      script.onload = () => {
        console.log('PayPal script loaded');
        setPaypalReady(true);
        setPaypalLoading(false);
      };
      
      script.onerror = () => {
        setPaypalError('Failed to load PayPal');
        setPaypalLoading(false);
      };
      
      document.head.appendChild(script);
      
    } catch (error: any) {
      console.error('PayPal config error:', error);
      setPaypalError(error.message);
      setPaypalLoading(false);
    }
  };

  // Render PayPal button when ready
  useEffect(() => {
    if (paypalReady && window.paypal && paypalRef.current && !paypalRef.current.hasChildNodes()) {
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
            if (onError) onError(error);
          }
        },
        onError: (error: any) => {
          console.error('PayPal error:', error);
          if (onError) onError(error);
        }
      }).render(paypalRef.current);
    }
  }, [paypalReady, amount, planName, onSuccess, onError]);

  // Handle Tap payment
  const handleTapPayment = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to continue",
        variant: "destructive"
      });
      return;
    }

    setTapLoading(true);
    setTapError(null);

    try {
      // Direct fetch to get Tap config
      const configResponse = await fetch(`https://fxkqgjakbyrxkmevkglv.supabase.co/functions/v1/create-tap-session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4a3FnamFrYnlyeGttZXZrZ2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ4ODY4NjksImV4cCI6MjA2MDQ2Mjg2OX0.u4O7nvVrW6HZjZj058T9kKpEfa5BsyWT0i_p4UxcZi4`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4a3FnamFrYnlyeGttZXZrZ2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ4ODY4NjksImV4cCI6MjA2MDQ2Mjg2OX0.u4O7nvVrW6HZjZj058T9kKpEfa5BsyWT0i_p4UxcZi4',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: amount * 0.307, // USD to KWD conversion
          planName,
          currency: 'KWD'
        })
      });

      if (!configResponse.ok) {
        throw new Error('Failed to get Tap config');
      }

      const config = await configResponse.json();

      // Load Tap script if not loaded
      if (!window.Tapjsli) {
        const script = document.createElement('script');
        script.src = 'https://tap.company/js/pay.js';
        
        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Tap script'));
          document.head.appendChild(script);
        });
      }

      // Initialize Tap payment
      window.Tapjsli({
        publicKey: config.publishableKey,
        merchant: config.publishableKey,
        amount: config.amount,
        currency: 'KWD',
        customer: {
          id: user.id,
          email: user.email
        },
        onSuccess: (response: any) => {
          console.log('Tap payment success:', response);
          setTapLoading(false);
          onSuccess({
            paymentId: response.transaction?.id || response.id,
            paymentMethod: 'tap'
          });
        },
        onError: (error: any) => {
          console.error('Tap payment error:', error);
          setTapLoading(false);
          setTapError(error.message || 'Payment failed');
          if (onError) onError(error);
        },
        onClose: () => {
          setTapLoading(false);
        }
      });

    } catch (error: any) {
      console.error('Tap initialization error:', error);
      setTapError(error.message);
      setTapLoading(false);
    }
  };

  // Load PayPal on mount
  useEffect(() => {
    loadPayPalScript();
  }, []);

  return (
    <div className="space-y-6">
      {/* PayPal Section */}
      <div>
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <span>PayPal</span>
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Recommended</span>
        </h4>
        <p className="text-xs text-muted-foreground mb-3">
          Pay with PayPal, debit card, or credit card
        </p>
        
        {paypalLoading && (
          <div className="w-full h-12 flex items-center justify-center border rounded">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm">Loading PayPal...</span>
          </div>
        )}
        
        {paypalError && (
          <div className="w-full p-4 bg-red-50 border border-red-200 rounded">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <p className="text-red-800 text-sm">{paypalError}</p>
            </div>
            <Button size="sm" variant="outline" onClick={loadPayPalScript}>
              Retry PayPal
            </Button>
          </div>
        )}
        
        {!paypalLoading && !paypalError && (
          <div ref={paypalRef} className="w-full min-h-[45px]" />
        )}
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or</span>
        </div>
      </div>

      {/* Tap Payment Section */}
      <div>
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <span>Tap Payments (KWD)</span>
        </h4>
        <p className="text-xs text-muted-foreground mb-3">
          Pay with your local credit card in Kuwaiti Dinar
        </p>
        
        {tapError && (
          <div className="w-full p-4 bg-red-50 border border-red-200 rounded mb-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <p className="text-red-800 text-sm">{tapError}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setTapError(null)}>
              Retry Tap Payment
            </Button>
          </div>
        )}
        
        <Button 
          className="w-full" 
          onClick={handleTapPayment}
          disabled={tapLoading}
        >
          {tapLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            `Pay with Tap Payment (${(amount * 0.307).toFixed(2)} KWD)`
          )}
        </Button>
      </div>
    </div>
  );
}
