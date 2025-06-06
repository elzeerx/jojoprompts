
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { usePayPalConfig } from "./hooks/usePayPalConfig";
import { usePayPalScript } from "./hooks/usePayPalScript";

declare global {
  interface Window {
    paypal?: any;
  }
}

interface PayPalButtonProps {
  amount: number;
  planName: string;
  onSuccess: (paymentId: string, details: any) => void;
  onError?: (error: any) => void;
}

export function PayPalButton({ amount, planName, onSuccess, onError }: PayPalButtonProps) {
  const paypalRef = useRef<HTMLDivElement>(null);
  const [buttonRendered, setButtonRendered] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const { config, loading: configLoading, error: configError } = usePayPalConfig();
  const { scriptLoaded, loading: scriptLoading, error: scriptError, loadScript } = usePayPalScript();

  useEffect(() => {
    if (config && !scriptLoaded && !scriptLoading && retryCount < 3) {
      console.log("Attempting to load PayPal script, retry:", retryCount);
      loadScript(config);
    }
  }, [config, scriptLoaded, scriptLoading, loadScript, retryCount]);

  useEffect(() => {
    if (scriptLoaded && !buttonRendered && paypalRef.current) {
      try {
        console.log("Rendering PayPal button");
        
        window.paypal.Buttons({
          createOrder: (data: any, actions: any) => {
            return actions.order.create({
              purchase_units: [{
                amount: {
                  value: amount.toString(),
                  currency_code: "USD"
                },
                description: `${planName} Plan`
              }]
            });
          },
          onApprove: async (data: any, actions: any) => {
            try {
              const details = await actions.order.capture();
              console.log("PayPal payment approved:", data.orderID);
              onSuccess(data.orderID, details);
            } catch (error) {
              console.error("PayPal capture error:", error);
              if (onError) onError(error);
            }
          },
          onError: (error: any) => {
            console.error("PayPal error:", error);
            if (onError) onError(error);
          }
        }).render(paypalRef.current);
        
        setButtonRendered(true);
        console.log("PayPal button rendered successfully");
        
      } catch (error: any) {
        console.error("PayPal button render error:", error);
        if (onError) onError(error);
      }
    }
  }, [scriptLoaded, buttonRendered, amount, planName, onSuccess, onError]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setButtonRendered(false);
    if (paypalRef.current) {
      paypalRef.current.innerHTML = '';
    }
  };

  const error = configError || scriptError;
  const loading = configLoading || scriptLoading;

  if (error) {
    return (
      <div className="w-full p-4 bg-red-50 border border-red-200 rounded">
        <p className="text-red-800 text-sm mb-2">{error}</p>
        <Button size="sm" variant="outline" onClick={handleRetry}>
          Retry ({retryCount}/3)
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full h-12 flex items-center justify-center border rounded">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm">Loading PayPal...</span>
      </div>
    );
  }

  return <div ref={paypalRef} className="w-full min-h-[45px]" />;
}
