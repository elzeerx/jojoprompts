
import { useState, useCallback, useRef } from "react";

interface PayPalConfig {
  clientId: string;
  environment: string;
  currency: string;
}

export function usePayPalScript() {
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const loadingRef = useRef(false);

  const loadPayPalScript = useCallback(async (config: PayPalConfig) => {
    // Prevent multiple simultaneous loads
    if (loadingRef.current) {
      console.log("PayPal script already loading, skipping...");
      return;
    }

    if (window.paypal) {
      console.log("PayPal already loaded");
      setIsScriptLoaded(true);
      setScriptError(null);
      return;
    }

    loadingRef.current = true;
    setIsLoading(true);
    setScriptError(null);

    return new Promise<void>((resolve, reject) => {
      // Clean up any existing failed scripts
      const existingScripts = document.querySelectorAll('script[src*="paypal.com"]');
      existingScripts.forEach(script => {
        if (script.getAttribute('data-failed') === 'true') {
          script.remove();
        }
      });

      const script = document.createElement("script");
      const environment = config.environment === "production" ? "" : ".sandbox";
      
      // Use a more reliable PayPal SDK URL with essential parameters only
      script.src = `https://www${environment}.paypal.com/sdk/js?client-id=${config.clientId}&currency=${config.currency}&intent=capture&components=buttons`;
      script.async = true;
      script.defer = true;
      
      let timeoutId: NodeJS.Timeout;
      let resolved = false;
      
      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        script.onload = null;
        script.onerror = null;
        loadingRef.current = false;
        setIsLoading(false);
      };
      
      const resolveOnce = () => {
        if (!resolved) {
          resolved = true;
          cleanup();
          console.log("PayPal script loaded successfully");
          setIsScriptLoaded(true);
          setScriptError(null);
          resolve();
        }
      };

      const rejectOnce = (error: string) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          script.setAttribute('data-failed', 'true');
          console.error("PayPal script failed to load:", error);
          setScriptError(error);
          setIsScriptLoaded(false);
          reject(new Error(error));
        }
      };
      
      // Set a longer timeout for better reliability
      timeoutId = setTimeout(() => {
        rejectOnce("PayPal script loading timeout after 30 seconds");
      }, 30000);
      
      script.onload = () => {
        // Additional check to ensure PayPal is actually available
        setTimeout(() => {
          if (window.paypal) {
            resolveOnce();
          } else {
            rejectOnce("PayPal object not available after script load");
          }
        }, 500);
      };
      
      script.onerror = () => {
        rejectOnce("Network error loading PayPal script");
      };
      
      try {
        document.head.appendChild(script);
        console.log("PayPal script loading started:", script.src);
      } catch (error) {
        rejectOnce("Failed to append PayPal script to document");
      }
    });
  }, []);

  const resetScript = useCallback(() => {
    setIsScriptLoaded(false);
    setScriptError(null);
    setIsLoading(false);
    loadingRef.current = false;
  }, []);

  return {
    isScriptLoaded,
    scriptError,
    isLoading,
    loadPayPalScript,
    resetScript
  };
}
