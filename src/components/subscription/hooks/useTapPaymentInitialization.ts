
import { useCallback } from 'react';

interface TapPaymentConfig {
  containerID: string;
  amount: number;
  currency: string;
  onSuccess: (response: any) => void;
  onError: (error: any) => void;
  onClose: () => void;
}

export function useTapPaymentInitialization() {
  const initializeTapPayment = useCallback((config: TapPaymentConfig, publishableKey: string) => {
    if (!window.Tapjsli) {
      throw new Error("Payment system not available. Please try again.");
    }

    if (!publishableKey) {
      throw new Error("Payment configuration missing. Please contact support.");
    }

    try {
      console.log("Initializing Tap Payment with config:", { 
        amount: config.amount, 
        currency: config.currency,
        containerID: config.containerID 
      });
      
      // Create a Tap instance with the publishable key from backend
      const tap = window.Tapjsli(publishableKey);
      
      tap.setup({
        containerID: config.containerID,
        currencies: [config.currency],
        amount: config.amount,
        defaultCurrency: config.currency,
        uiLanguage: "en",
        onReady: () => {
          console.log("Tap payment ready");
        },
        onSuccess: (response: any) => {
          console.log("Tap payment success response:", response);
          config.onSuccess(response);
        },
        onError: (error: any) => {
          console.error("Tap payment error:", error);
          config.onError(error);
        },
        onClose: () => {
          console.log("Tap payment dialog closed");
          config.onClose();
        }
      });
    } catch (error) {
      console.error("Error initializing Tap Payment:", error);
      throw new Error("Failed to initialize payment. Please try again.");
    }
  }, []);

  return {
    initializeTapPayment
  };
}
