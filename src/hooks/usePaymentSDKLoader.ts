
import { useRef, useCallback } from 'react';

interface PaymentSDKLoader {
  loadPayPalSDK: (clientId: string) => Promise<void>;
  loadTapSDK: () => Promise<void>;
  resetPayPal: () => void;
  resetTap: () => void;
}

export function usePaymentSDKLoader(): PaymentSDKLoader {
  const paypalLoadingRef = useRef<Promise<void> | null>(null);
  const tapLoadingRef = useRef<Promise<void> | null>(null);
  const paypalLoadedRef = useRef(false);
  const tapLoadedRef = useRef(false);

  const loadPayPalSDK = useCallback(async (clientId: string): Promise<void> => {
    if (paypalLoadingRef.current) {
      return paypalLoadingRef.current;
    }

    if (paypalLoadedRef.current && window.paypal) {
      return Promise.resolve();
    }

    paypalLoadingRef.current = new Promise((resolve, reject) => {
      // Remove existing script
      const existingScript = document.getElementById('paypal-sdk');
      if (existingScript) {
        existingScript.remove();
      }

      const script = document.createElement('script');
      script.id = 'paypal-sdk';
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&components=buttons`;
      script.async = true;

      const timeout = setTimeout(() => {
        reject(new Error('PayPal SDK loading timeout'));
      }, 30000);

      script.onload = () => {
        clearTimeout(timeout);
        if (window.paypal) {
          paypalLoadedRef.current = true;
          resolve();
        } else {
          reject(new Error('PayPal SDK loaded but paypal object not available'));
        }
      };

      script.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Failed to load PayPal SDK'));
      };

      document.head.appendChild(script);
    });

    return paypalLoadingRef.current;
  }, []);

  const loadTapSDK = useCallback(async (): Promise<void> => {
    if (tapLoadingRef.current) {
      return tapLoadingRef.current;
    }

    if (tapLoadedRef.current && window.Tapjsli) {
      return Promise.resolve();
    }

    tapLoadingRef.current = new Promise((resolve, reject) => {
      // Remove existing script
      const existingScript = document.getElementById('tap-sdk');
      if (existingScript) {
        existingScript.remove();
      }

      const script = document.createElement('script');
      script.id = 'tap-sdk';
      script.src = 'https://tap.company/js/pay.js';
      script.async = true;

      const timeout = setTimeout(() => {
        reject(new Error('Tap SDK loading timeout'));
      }, 30000);

      script.onload = () => {
        clearTimeout(timeout);
        if (window.Tapjsli) {
          tapLoadedRef.current = true;
          resolve();
        } else {
          reject(new Error('Tap SDK loaded but Tapjsli object not available'));
        }
      };

      script.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Failed to load Tap SDK'));
      };

      document.head.appendChild(script);
    });

    return tapLoadingRef.current;
  }, []);

  const resetPayPal = useCallback(() => {
    const script = document.getElementById('paypal-sdk');
    if (script) {
      script.remove();
    }
    paypalLoadingRef.current = null;
    paypalLoadedRef.current = false;
  }, []);

  const resetTap = useCallback(() => {
    const script = document.getElementById('tap-sdk');
    if (script) {
      script.remove();
    }
    tapLoadingRef.current = null;
    tapLoadedRef.current = false;
  }, []);

  return {
    loadPayPalSDK,
    loadTapSDK,
    resetPayPal,
    resetTap
  };
}
