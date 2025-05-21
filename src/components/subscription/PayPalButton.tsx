
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

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
  testMode?: boolean;
}

export function PayPalButton({ amount, planName, onSuccess, onError, testMode = false }: PayPalButtonProps) {
  const paypalRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);

  // Handle test mode simulation
  const handleTestPayment = () => {
    console.log("Test payment initiated", { amount, planName });
    const mockPaymentId = `TEST-${Date.now()}`;
    const mockDetails = {
      id: mockPaymentId,
      status: "COMPLETED",
      purchase_units: [{ amount: { value: amount } }],
      payer: { email_address: "test@example.com" },
      create_time: new Date().toISOString(),
    };
    
    setTimeout(() => {
      console.log("Test payment completed", mockDetails);
      onSuccess(mockPaymentId, mockDetails);
    }, 1500);
  };

  // Load PayPal script
  useEffect(() => {
    if (testMode) {
      setIsLoading(false);
      return;
    }

    const scriptId = "paypal-sdk-js";
    let existingScript = document.getElementById(scriptId) as HTMLScriptElement;
    
    if (existingScript) {
      console.log("PayPal script already loaded");
      setIsScriptLoaded(true);
      return;
    }

    console.log("Loading PayPal SDK script");
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://www.paypal.com/sdk/js?client-id=ASWIAiw0-UM6BaTa1QRptIh0cIip9C2L-r4URQb7CZZy8GZ-t8h-d6naylfIlAPnnfyoYeRBgMSxLj9F&currency=USD&intent=capture`;
    script.async = true;
    
    script.onload = () => {
      console.log("PayPal SDK script loaded successfully");
      setIsScriptLoaded(true);
    };
    
    script.onerror = (error) => {
      console.error("PayPal script failed to load", error);
      setScriptError("Failed to load PayPal script. Please try again or use another payment method.");
      setIsLoading(false);
      onError(new Error("Failed to load PayPal script"));
    };
    
    document.body.appendChild(script);
    
    return () => {
      // Only remove script if we added it
      if (document.getElementById(scriptId) === script) {
        document.body.removeChild(script);
      }
    };
  }, [testMode]);
  
  // Initialize PayPal button once script is loaded
  useEffect(() => {
    if (testMode) return;
    
    if (isScriptLoaded && paypalRef.current) {
      setIsLoading(true);
      
      console.log("Initializing PayPal buttons");
      try {
        if (!window.paypal || !window.paypal.Buttons) {
          throw new Error("PayPal SDK loaded but Buttons API not available");
        }
        
        window.paypal
          .Buttons({
            fundingSource: window.paypal.FUNDING.PAYPAL,
            style: {
              layout: 'horizontal',
              color: 'gold',
              shape: 'rect',
              label: 'pay',
              height: 40
            },
            createOrder: (data: any, actions: any) => {
              console.log("Creating PayPal order", { amount, planName });
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
              console.log("PayPal order approved", data);
              try {
                const order = await actions.order.capture();
                console.log("PayPal order captured", order);
                onSuccess(order.id, order);
              } catch (captureError) {
                console.error("Error capturing PayPal order", captureError);
                onError(captureError);
              }
            },
            onError: (err: any) => {
              console.error("PayPal error", err);
              onError(err);
              toast({
                title: "Payment Error",
                description: "There was an error processing your PayPal payment. Please try again.",
                variant: "destructive"
              });
            },
            onCancel: () => {
              console.log("PayPal payment cancelled by user");
              toast({
                title: "Payment Cancelled",
                description: "You've cancelled the PayPal payment process.",
                variant: "default"
              });
            }
          })
          .render(paypalRef.current)
          .then(() => {
            console.log("PayPal buttons rendered successfully");
            setIsLoading(false);
          })
          .catch((renderError: any) => {
            console.error("Failed to render PayPal buttons", renderError);
            setScriptError("Failed to initialize PayPal. Please try again later.");
            setIsLoading(false);
            onError(renderError);
          });
      } catch (error) {
        console.error("Error initializing PayPal", error);
        setScriptError("Failed to initialize PayPal. Please try again or use another payment method.");
        setIsLoading(false);
        onError(error);
      }
    }
  }, [isScriptLoaded, amount, onSuccess, onError, planName, testMode]);

  if (testMode) {
    return (
      <div className="w-full">
        <Button 
          className="w-full bg-yellow-500 hover:bg-yellow-600" 
          onClick={handleTestPayment}
        >
          Test PayPal Payment (Simulation)
        </Button>
        <div className="text-center text-sm text-gray-500 mt-2">
          <p>Test mode enabled. No actual payment will be processed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {isLoading && (
        <Button className="w-full" disabled>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading PayPal...
        </Button>
      )}
      
      {scriptError && (
        <div className="text-center text-sm text-red-500 mb-2">
          {scriptError}
        </div>
      )}
      
      <div ref={paypalRef} className={isLoading ? "hidden" : ""}></div>
      
      <div className="text-center text-sm text-gray-500 mt-2">
        <p>For testing, use email: sb-47g8u34123282@personal.example.com and password: 12345678</p>
      </div>
    </div>
  );
}
