
import { useState } from 'react';

export function useTapPaymentScript() {
  const [isLoading, setIsLoading] = useState(false);

  const loadTapPaymentScript = (): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector('script[src*="tap.company"]');
      if (existingScript) {
        resolve();
        return;
      }

      setIsLoading(true);
      const script = document.createElement("script");
      script.src = "https://secure.tap.company/checkout/js/setup-v2.js";
      script.async = true;
      script.onload = () => {
        console.log("Tap Payment script loaded successfully");
        setIsLoading(false);
        resolve();
      };
      script.onerror = () => {
        console.error("Failed to load Tap Payment script");
        setIsLoading(false);
        reject(new Error("Failed to load Tap Payment script"));
      };
      document.head.appendChild(script);
    });
  };

  return {
    loadTapPaymentScript,
    isLoading
  };
}
