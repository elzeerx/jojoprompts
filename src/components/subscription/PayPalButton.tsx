
import React, { useEffect, useRef } from "react";
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
  onSuccess: (paymentId: string, details: any) => void;
  onError: (error: any) => void;
}

export function PayPalButton({ amount, planName, onSuccess, onError }: PayPalButtonProps) {
  const paypalRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isScriptLoaded, setIsScriptLoaded] = React.useState(false);

  // Load PayPal script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=ASWIAiw0-UM6BaTa1QRptIh0cIip9C2L-r4URQb7CZZy8GZ-t8h-d6naylfIlAPnnfyoYeRBgMSxLj9F&currency=USD`;
    script.async = true;
    script.onload = () => {
      setIsScriptLoaded(true);
    };
    script.onerror = () => {
      console.error("PayPal script failed to load");
      setIsLoading(false);
      onError(new Error("Failed to load PayPal script"));
    };
    
    document.body.appendChild(script);
    
    return () => {
      document.body.removeChild(script);
    };
  }, []);
  
  // Initialize PayPal button once script is loaded
  useEffect(() => {
    if (isScriptLoaded && paypalRef.current) {
      setIsLoading(false);
      
      try {
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
              const order = await actions.order.capture();
              onSuccess(order.id, order);
            },
            onError: (err: any) => {
              console.error(err);
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
          .render(paypalRef.current);
      } catch (error) {
        console.error("Failed to render PayPal button", error);
        onError(error);
      }
    }
  }, [isScriptLoaded, amount, onSuccess, onError, planName]);

  return (
    <div className="w-full">
      {isLoading && (
        <Button className="w-full" disabled>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading PayPal...
        </Button>
      )}
      <div ref={paypalRef}></div>
      <div className="text-center text-sm text-gray-500 mt-2">
        <p>For testing, use email: sb-47g8u34123282@personal.example.com and password: 12345678</p>
      </div>
    </div>
  );
}
