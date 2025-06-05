
import { useState, useCallback } from "react";

interface PayPalConfig {
  clientId: string;
  environment: string;
  currency: string;
}

export function usePayPalScript() {
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);

  const loadPayPalScript = useCallback(async (config: PayPalConfig) => {
    return new Promise<void>((resolve, reject) => {
      if (window.paypal) {
        console.log("PayPal already loaded");
        setIsScriptLoaded(true);
        resolve();
        return;
      }

      // Clean up any existing scripts
      const existingScripts = document.querySelectorAll('script[src*="paypal.com"]');
      existingScripts.forEach(script => script.remove());

      const script = document.createElement("script");
      const environment = config.environment === "production" ? "" : ".sandbox";
      script.src = `https://www${environment}.paypal.com/sdk/js?client-id=${config.clientId}&currency=${config.currency}&intent=capture&enable-funding=venmo,card&disable-funding=credit`;
      script.async = true;
      script.defer = true;
      
      let timeoutId: NodeJS.Timeout;
      
      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        script.onload = null;
        script.onerror = null;
      };
      
      timeoutId = setTimeout(() => {
        cleanup();
        console.error("PayPal script loading timeout");
        setScriptError("PayPal script loading timeout");
        reject(new Error("PayPal script loading timeout"));
      }, 20000);
      
      script.onload = () => {
        cleanup();
        console.log("PayPal script loaded successfully");
        setIsScriptLoaded(true);
        setScriptError(null);
        resolve();
      };
      
      script.onerror = (event) => {
        cleanup();
        console.error("PayPal script failed to load:", event);
        setScriptError("Failed to load PayPal script");
        reject(new Error("Failed to load PayPal script"));
      };
      
      document.head.appendChild(script);
    });
  }, []);

  return {
    isScriptLoaded,
    scriptError,
    loadPayPalScript,
    setIsScriptLoaded
  };
}
