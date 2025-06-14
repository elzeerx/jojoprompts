
import { useState, useEffect } from 'react';

export function usePayPalSDK(clientId: string | null, error: string | null) {
  const [isLoading, setIsLoading] = useState(true);
  const [sdkError, setSdkError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId || error) return;

    const loadPayPalScript = () => {
      if (window.paypal) {
        setIsLoading(false);
        return;
      }

      // Remove any existing PayPal scripts
      const existingScripts = document.querySelectorAll('script[src*="paypal.com/sdk"]');
      existingScripts.forEach(script => script.remove());

      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=capture`;
      script.async = true;
      
      script.onload = () => {
        if (window.paypal) {
          setIsLoading(false);
        } else {
          setSdkError('PayPal SDK failed to initialize');
        }
      };
      
      script.onerror = () => {
        setSdkError('Failed to load PayPal payment system');
        setIsLoading(false);
      };
      
      document.head.appendChild(script);
    };

    loadPayPalScript();
  }, [clientId, error]);

  return { isLoading, sdkError };
}
