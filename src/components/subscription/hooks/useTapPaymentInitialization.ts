
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
  const initializeTapPayment = useCallback((config: TapPaymentConfig) => {
    if (!window.Tapjsli) {
      throw new Error("Payment system not available. Please try again.");
    }

    try {
      // Create a Tap instance with the publishable key
      const tap = window.Tapjsli("pk_test_b5JZWEaPCRy61rhY4dqMnUiw");
      
      tap.setup({
        containerID: config.containerID,
        currencies: [config.currency],
        amount: config.amount,
        defaultCurrency: config.currency,
        uiLanguage: "en",
        onReady: () => {
          console.log("Tap payment ready");
        },
        onSuccess: config.onSuccess,
        onError: config.onError,
        onClose: config.onClose
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
