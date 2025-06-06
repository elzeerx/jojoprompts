
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

    setLoading(true);
    setError(null);

    try {
      const script = document.createElement("script");
      const environment = config.environment === "production" ? "" : ".sandbox";
      script.src = `https://www${environment}.paypal.com/sdk/js?client-id=${config.clientId}&currency=${config.currency}&intent=capture`;
      script.async = true;

      await new Promise((resolve, reject) => {
        script.onload = () => {
          if (window.paypal) {
            setScriptLoaded(true);
            resolve(undefined);
          } else {
            reject(new Error("PayPal object not available"));
          }
        };
        script.onerror = () => reject(new Error("Failed to load PayPal script"));
        document.head.appendChild(script);
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  return { scriptLoaded, loading, error, loadScript };
}
