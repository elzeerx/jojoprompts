
import { useState, useCallback } from "react";

interface PayPalConfig {
  clientId: string;
  environment: string;
  currency: string;
}

export function usePayPalScript() {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadScript = useCallback(async (config: PayPalConfig) => {
    if (window.paypal) {
      setScriptLoaded(true);
      return;
    }

    if (loading) return;

    try {
      setLoading(true);
      setError(null);
      
      console.log("Loading PayPal script...");
      
      const environment = config.environment === "production" ? "" : ".sandbox";
      const scriptSrc = `https://www${environment}.paypal.com/sdk/js?client-id=${config.clientId}&currency=${config.currency}&intent=capture`;
      
      const existingScript = document.querySelector(`script[src="${scriptSrc}"]`);
      if (existingScript) {
        existingScript.remove();
      }

      const script = document.createElement("script");
      script.src = scriptSrc;
      script.async = true;

      const loadPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("PayPal script loading timeout"));
        }, 10000);

        script.onload = () => {
          clearTimeout(timeout);
          if (window.paypal) {
            console.log("PayPal script loaded successfully");
            setScriptLoaded(true);
            resolve();
          } else {
            reject(new Error("PayPal object not available"));
          }
        };

        script.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("Failed to load PayPal script"));
        };
      });

      document.head.appendChild(script);
      await loadPromise;

    } catch (err: any) {
      console.error("PayPal script loading error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  return { scriptLoaded, loading, error, loadScript };
}
