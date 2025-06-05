
import { useState, useCallback, useRef } from "react";

interface PayPalConfig {
  clientId: string;
  environment: string;
  currency: string;
}

interface UsePayPalButtonProps {
  amount: number;
  planName: string;
  onSuccess: (paymentId: string, details: any) => void;
  onError: (error: any) => void;
  paypalConfig: PayPalConfig;
}

export function usePayPalButton({ 
  amount, 
  planName, 
  onSuccess, 
  onError, 
  paypalConfig 
}: UsePayPalButtonProps) {
  const paypalRef = useRef<HTMLDivElement>(null);
  const [buttonRendered, setButtonRendered] = useState(false);
  const [buttonError, setButtonError] = useState<string | null>(null);

  const initializePayPalButton = useCallback(() => {
    if (!window.paypal || !paypalRef.current || buttonRendered) {
      return;
    }

    try {
      console.log("Initializing PayPal button with amount:", amount.toFixed(2));
      
      window.paypal
        .Buttons({
          createOrder: (data: any, actions: any) => {
            console.log("Creating PayPal order for amount:", amount.toFixed(2));
            return actions.order.create({
              purchase_units: [
                {
                  description: `JojoPrompts - ${planName} Plan`,
                  amount: {
                    currency_code: paypalConfig.currency,
                    value: amount.toFixed(2),
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
              onSuccess(order.id, order);
            } catch (error) {
              console.error("Error capturing PayPal order:", error);
              onError(error);
            }
          },
          onCancel: () => {
            console.log("PayPal payment canceled by user");
          },
          onError: (err: any) => {
            console.error("PayPal button error:", err);
            onError(err);
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
          setButtonError(null);
        })
        .catch((error: any) => {
          console.error("Failed to render PayPal button:", error);
          setButtonError("Failed to initialize PayPal payment. Please refresh the page and try again.");
          onError(error);
        });
    } catch (error) {
      console.error("Failed to initialize PayPal button:", error);
      setButtonError("Failed to initialize PayPal payment system.");
      onError(error);
    }
  }, [amount, planName, onSuccess, onError, paypalConfig, buttonRendered]);

  const resetButton = useCallback(() => {
    setButtonRendered(false);
    setButtonError(null);
  }, []);

  return {
    paypalRef,
    buttonRendered,
    buttonError,
    initializePayPalButton,
    resetButton
  };
}
