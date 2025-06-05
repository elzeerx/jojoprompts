
import { useState } from 'react';

export function useTapPaymentScript() {
  const [isLoading, setIsLoading] = useState(false);

  const loadTapPaymentScript = (): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      // Check if already loaded
      if (window.Tapjsli) {
        console.log("Tap script already loaded");
        resolve();
        return;
      }

      const existingScript = document.querySelector('script[src*="tap.company"]');
      if (existingScript) {
        // Wait for existing script to load
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', () => reject(new Error("Existing Tap script failed")));
        return;
      }

      setIsLoading(true);
      const script = document.createElement("script");
      script.src = "https://secure.tap.company/checkout/js/setup-v2.js";
      script.async = true;
      script.defer = true;
      
      let timeoutId: NodeJS.Timeout;
      
      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        script.onload = null;
        script.onerror = null;
        setIsLoading(false);
      };
      
      timeoutId = setTimeout(() => {
        cleanup();
        console.error("Tap Payment script loading timeout");
        reject(new Error("Tap Payment script loading timeout"));
      }, 15000);
      
      script.onload = () => {
        cleanup();
        console.log("Tap Payment script loaded successfully");
        resolve();
      };
      
      script.onerror = (event) => {
        cleanup();
        console.error("Failed to load Tap Payment script:", event);
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
