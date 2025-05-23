
import React, { useEffect, useRef, useState } from "react";
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
  className?: string; // Added to match usage in CheckoutPage
  onSuccess: (paymentId: string, details: any) => void;
  onError?: (error: any) => void; // Made optional to match usage
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

  // Clean up function to remove PayPal buttons
  const cleanupPayPalButtons = () => {
    if (paypalRef.current) {
      // Clear the container
      while (paypalRef.current.firstChild) {
        paypalRef.current.removeChild(paypalRef.current.firstChild);
      }
      setButtonRendered(false);
    }
  };

  // Load PayPal script
  useEffect(() => {
    // Remove any existing PayPal script to avoid duplicates
    const existingScript = document.querySelector('script[src*="paypal.com/sdk/js"]');
    if (existingScript) {
      document.body.removeChild(existingScript);
    }

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=ASWIAiw0-UM6BaTa1QRptIh0cIip9C2L-r4URQb7CZZy8GZ-t8h-d6naylfIlAPnnfyoYeRBgMSxLj9F&currency=USD`;
    script.async = true;
    script.onload = () => {
      console.log("PayPal script loaded successfully");
      setIsScriptLoaded(true);
    };
    script.onerror = () => {
      console.error("PayPal script failed to load");
      setIsLoading(false);
      onError(new Error("Failed to load PayPal script"));
    };
    
    document.body.appendChild(script);
    
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
      cleanupPayPalButtons();
    };
  }, []);
  
  // Initialize PayPal button once script is loaded
  useEffect(() => {
    if (isScriptLoaded && paypalRef.current && !buttonRendered) {
      setIsLoading(false);
      
      try {
        cleanupPayPalButtons(); // Clean up any existing buttons
        
        window.paypal
          .Buttons({
            createOrder: (data: any, actions: any) => {
              return actions.order.create({
                purchase_units: [
                  {
                    description: `JojoPrompts - ${planName} Plan`,
                    amount: {
                      currency_code: "USD",
                      value: amount.toFixed(2),
                    },
                  },
                ],
              });
            },
            onApprove: async (data: any, actions: any) => {
              try {
                const order = await actions.order.capture();
                console.log("Payment successful:", order);
                onSuccess(order.id, order);
              } catch (error) {
                console.error("Error capturing order:", error);
                onError(error);
              }
            },
            onCancel: () => {
              console.log("Payment canceled by user");
            },
            onError: (err: any) => {
              console.error("PayPal error:", err);
              onError(err);
            },
            style: {
              layout: 'horizontal',
              color: 'gold',
              shape: 'rect',
              label: 'pay',
              height: 40
            }
          })
          .render(paypalRef.current)
          .then(() => {
            setButtonRendered(true);
            console.log("PayPal button rendered successfully");
          })
          .catch((error: any) => {
            console.error("Failed to render PayPal button:", error);
            onError(error);
          });
      } catch (error) {
        console.error("Failed to initialize PayPal button:", error);
        onError(error);
      }
    }
  }, [isScriptLoaded, amount, onSuccess, onError, planName, buttonRendered]);

  return (
    <div className={`w-full ${className}`}>
      {isLoading && (
        <Button className="w-full" disabled>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading PayPal...
        </Button>
      )}
      <div ref={paypalRef} className="paypal-button-container"></div>
    </div>
  );
}
