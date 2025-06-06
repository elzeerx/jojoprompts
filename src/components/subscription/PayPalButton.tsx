
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
  const [buttonError, setButtonError] = useState<string | null>(null);

  const { config, loading: configLoading, error: configError } = usePayPalConfig();
  const { scriptLoaded, loading: scriptLoading, error: scriptError, loadScript } = usePayPalScript();

  // Load script when config is ready
  useEffect(() => {
    if (config && !scriptLoaded && !scriptLoading) {
      loadScript(config);
    }
  }, [config, scriptLoaded, scriptLoading, loadScript]);

  // Render button when script is loaded
  useEffect(() => {
    if (scriptLoaded && !buttonRendered && paypalRef.current) {
      try {
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
      } catch (error: any) {
        console.error("PayPal button render error:", error);
        setButtonError(error.message);
      }
    }
  }, [scriptLoaded, buttonRendered, amount, planName, onSuccess, onError]);

  const error = configError || scriptError || buttonError;
  const loading = configLoading || scriptLoading;

  if (error) {
    return (
      <div className="w-full p-4 bg-red-50 border border-red-200 rounded">
        <p className="text-red-800 text-sm mb-2">{error}</p>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={() => window.location.reload()}
        >
          Retry
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
