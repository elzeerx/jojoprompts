
import React, { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

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

  // Load PayPal script
  useEffect(() => {
    if (window.paypal) {
      setIsScriptLoaded(true);
      setIsLoading(false);
      return;
    }

    const script = document.createElement("script");
    // Updated to use proper sandbox client ID with better configuration
    script.src = `https://www.paypal.com/sdk/js?client-id=ASWIAiw0-UM6BaTa1QRptIh0cIip9C2L-r4URQb7CZZy8GZ-t8h-d6naylfIlAPnnfyoYeRBgMSxLj9F&currency=USD&intent=capture&enable-funding=venmo,card&disable-funding=credit`;
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
  }, [handleError]);
  
  // Initialize PayPal button once script is loaded
  useEffect(() => {
    if (!isScriptLoaded || !paypalRef.current || buttonRendered || !window.paypal) {
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
                    currency_code: "USD",
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
  }, [isScriptLoaded, memoizedAmount, planName, buttonRendered, handleSuccess, handleError]);

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
