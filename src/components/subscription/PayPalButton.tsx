
import React, { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    paypal?: any;
  }
}

interface PayPalButtonProps {
  amount: number;
  planName: string;
  className?: string;
  onSuccess: (paymentId: string, details: any) => void;
  onError?: (error: any) => void;
}

interface PayPalConfig {
  clientId: string;
  environment: string;
  currency: string;
}

export function PayPalButton({ 
  amount, 
  planName, 
  className = "", 
  onSuccess, 
  onError = (error) => console.error("PayPal error:", error) 
}: PayPalButtonProps) {
  const paypalRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [buttonRendered, setButtonRendered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paypalConfig, setPaypalConfig] = useState<PayPalConfig | null>(null);

  // Memoize the payment amount to prevent unnecessary re-renders
  const memoizedAmount = React.useMemo(() => amount.toFixed(2), [amount]);

  const handleSuccess = useCallback((paymentId: string, details: any) => {
    console.log("PayPal payment successful:", { paymentId, details });
    onSuccess(paymentId, details);
  }, [onSuccess]);

  const handleError = useCallback((error: any) => {
    console.error("PayPal payment error:", error);
    setError("Payment failed. Please try again.");
    onError(error);
  }, [onError]);

  // Fetch PayPal configuration
  useEffect(() => {
    const fetchPayPalConfig = async () => {
      try {
        console.log("Fetching PayPal configuration...");
        const { data, error } = await supabase.functions.invoke("get-paypal-config");
        
        if (error) {
          console.error("Error fetching PayPal config:", error);
          setError("Failed to load PayPal configuration. Please contact support.");
          setIsLoading(false);
          return;
        }

        if (!data?.clientId) {
          console.error("No PayPal client ID in response:", data);
          setError("PayPal is not properly configured. Please contact support.");
          setIsLoading(false);
          return;
        }

        console.log("PayPal config loaded:", { environment: data.environment, currency: data.currency });
        setPaypalConfig(data);
      } catch (error) {
        console.error("Failed to fetch PayPal config:", error);
        setError("Failed to initialize PayPal. Please refresh and try again.");
        setIsLoading(false);
      }
    };

    fetchPayPalConfig();
  }, []);

  // Load PayPal script
  useEffect(() => {
    if (!paypalConfig) return;

    if (window.paypal) {
      setIsScriptLoaded(true);
      setIsLoading(false);
      return;
    }

    const script = document.createElement("script");
    const environment = paypalConfig.environment === "production" ? "" : ".sandbox";
    script.src = `https://www${environment}.paypal.com/sdk/js?client-id=${paypalConfig.clientId}&currency=${paypalConfig.currency}&intent=capture&enable-funding=venmo,card&disable-funding=credit`;
    script.async = true;
    
    script.onload = () => {
      console.log("PayPal script loaded successfully");
      setIsScriptLoaded(true);
      setIsLoading(false);
    };
    
    script.onerror = () => {
      console.error("PayPal script failed to load");
      setError("Failed to load PayPal. Please refresh and try again.");
      setIsLoading(false);
      handleError(new Error("Failed to load PayPal script"));
    };
    
    document.head.appendChild(script);
    
    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [paypalConfig, handleError]);
  
  // Initialize PayPal button once script is loaded
  useEffect(() => {
    if (!isScriptLoaded || !paypalRef.current || buttonRendered || !window.paypal || !paypalConfig) {
      return;
    }

    try {
      window.paypal
        .Buttons({
          createOrder: (data: any, actions: any) => {
            console.log("Creating PayPal order for amount:", memoizedAmount);
            return actions.order.create({
              purchase_units: [
                {
                  description: `JojoPrompts - ${planName} Plan`,
                  amount: {
                    currency_code: paypalConfig.currency,
                    value: memoizedAmount,
                  },
                },
              ],
              application_context: {
                shipping_preference: "NO_SHIPPING"
              }
            });
          },
          onApprove: async (data: any, actions: any) => {
            try {
              console.log("PayPal payment approved, capturing order:", data.orderID);
              const order = await actions.order.capture();
              console.log("PayPal order captured successfully:", order);
              handleSuccess(order.id, order);
            } catch (error) {
              console.error("Error capturing PayPal order:", error);
              handleError(error);
            }
          },
          onCancel: () => {
            console.log("PayPal payment canceled by user");
            setError("Payment was canceled. You can try again.");
          },
          onError: (err: any) => {
            console.error("PayPal button error:", err);
            handleError(err);
          },
          style: {
            layout: 'vertical',
            color: 'gold',
            shape: 'rect',
            label: 'pay',
            height: 45,
            tagline: false
          }
        })
        .render(paypalRef.current)
        .then(() => {
          console.log("PayPal button rendered successfully");
          setButtonRendered(true);
        })
        .catch((error: any) => {
          console.error("Failed to render PayPal button:", error);
          setError("Failed to initialize PayPal. Please refresh and try again.");
          handleError(error);
        });
    } catch (error) {
      console.error("Failed to initialize PayPal button:", error);
      setError("Failed to initialize PayPal. Please refresh and try again.");
      handleError(error);
    }
  }, [isScriptLoaded, memoizedAmount, planName, buttonRendered, handleSuccess, handleError, paypalConfig]);

  if (error) {
    return (
      <div className={`w-full ${className}`}>
        <div className="p-4 border border-red-200 rounded-md bg-red-50">
          <p className="text-red-600 text-sm">{error}</p>
          <Button 
            className="w-full mt-2" 
            variant="outline"
            onClick={() => {
              setError(null);
              setIsLoading(true);
              setButtonRendered(false);
              window.location.reload();
            }}
          >
            Retry PayPal
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      {isLoading && (
        <div className="w-full min-h-[45px] flex items-center justify-center bg-gray-50 rounded">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          <span className="text-sm">Loading PayPal...</span>
        </div>
      )}
      <div 
        ref={paypalRef} 
        className={`paypal-button-container ${isLoading ? 'hidden' : ''}`}
        style={{ minHeight: isLoading ? '0' : '45px' }}
      />
    </div>
  );
}
