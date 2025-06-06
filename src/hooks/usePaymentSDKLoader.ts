
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

  const logSDKEvent = (sdk: string, event: string, data?: any) => {
    console.log(`[${sdk} SDK] ${event}:`, {
      timestamp: new Date().toISOString(),
      ...data
    });
  };

  const loadPayPalSDK = useCallback(async (clientId: string): Promise<void> => {
    logSDKEvent('PayPal', 'Load Request Started', { clientId: clientId.substring(0, 10) + '...' });

    if (paypalLoadingRef.current) {
      logSDKEvent('PayPal', 'Already Loading - Returning Existing Promise');
      return paypalLoadingRef.current;
    }

    if (paypalLoadedRef.current && window.paypal) {
      logSDKEvent('PayPal', 'Already Loaded - Returning Immediately');
      return Promise.resolve();
    }

    // Validate client ID format
    if (!clientId || !clientId.startsWith('A') || clientId.length < 50) {
      const error = new Error('Invalid PayPal client ID format provided');
      logSDKEvent('PayPal', 'Validation Failed', { error: error.message });
      throw error;
    }

    paypalLoadingRef.current = new Promise((resolve, reject) => {
      // Remove existing script
      const existingScript = document.getElementById('paypal-sdk');
      if (existingScript) {
        logSDKEvent('PayPal', 'Removing Existing Script');
        existingScript.remove();
      }

      const script = document.createElement('script');
      script.id = 'paypal-sdk';
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&components=buttons`;
      script.async = true;

      logSDKEvent('PayPal', 'Script Element Created', { src: script.src });

      const timeout = setTimeout(() => {
        logSDKEvent('PayPal', 'Loading Timeout - 30 seconds exceeded');
        script.remove();
        paypalLoadingRef.current = null;
        reject(new Error('PayPal SDK loading timeout after 30 seconds'));
      }, 30000);

      script.onload = () => {
        clearTimeout(timeout);
        logSDKEvent('PayPal', 'Script Loaded Successfully');
        
        // Wait a bit for PayPal object to be available
        setTimeout(() => {
          if (window.paypal) {
            paypalLoadedRef.current = true;
            logSDKEvent('PayPal', 'PayPal Object Available');
            resolve();
          } else {
            logSDKEvent('PayPal', 'Script Loaded but PayPal Object Missing');
            paypalLoadingRef.current = null;
            reject(new Error('PayPal SDK loaded but paypal object not available'));
          }
        }, 500);
      };

      script.onerror = (event) => {
        clearTimeout(timeout);
        logSDKEvent('PayPal', 'Script Load Error', { event });
        script.remove();
        paypalLoadingRef.current = null;
        reject(new Error('Failed to load PayPal SDK - network or server error'));
      };

      logSDKEvent('PayPal', 'Appending Script to Document Head');
      document.head.appendChild(script);
    });

    try {
      await paypalLoadingRef.current;
      logSDKEvent('PayPal', 'Load Completed Successfully');
    } catch (error) {
      paypalLoadingRef.current = null;
      logSDKEvent('PayPal', 'Load Failed', { error: error.message });
      throw error;
    }

    return paypalLoadingRef.current;
  }, []);

  const loadTapSDK = useCallback(async (): Promise<void> => {
    logSDKEvent('Tap', 'Load Request Started');

    if (tapLoadingRef.current) {
      logSDKEvent('Tap', 'Already Loading - Returning Existing Promise');
      return tapLoadingRef.current;
    }

    if (tapLoadedRef.current && window.Tapjsli) {
      logSDKEvent('Tap', 'Already Loaded - Returning Immediately');
      return Promise.resolve();
    }

    tapLoadingRef.current = new Promise((resolve, reject) => {
      // Remove existing script
      const existingScript = document.getElementById('tap-sdk');
      if (existingScript) {
        logSDKEvent('Tap', 'Removing Existing Script');
        existingScript.remove();
      }

      const script = document.createElement('script');
      script.id = 'tap-sdk';
      script.src = 'https://tap.company/js/pay.js';
      script.async = true;

      logSDKEvent('Tap', 'Script Element Created', { src: script.src });

      const timeout = setTimeout(() => {
        logSDKEvent('Tap', 'Loading Timeout - 30 seconds exceeded');
        script.remove();
        tapLoadingRef.current = null;
        reject(new Error('Tap SDK loading timeout after 30 seconds'));
      }, 30000);

      script.onload = () => {
        clearTimeout(timeout);
        logSDKEvent('Tap', 'Script Loaded Successfully');
        
        // Wait a bit for Tap object to be available
        setTimeout(() => {
          if (window.Tapjsli) {
            tapLoadedRef.current = true;
            logSDKEvent('Tap', 'Tapjsli Object Available');
            resolve();
          } else {
            logSDKEvent('Tap', 'Script Loaded but Tapjsli Object Missing');
            tapLoadingRef.current = null;
            reject(new Error('Tap SDK loaded but Tapjsli object not available'));
          }
        }, 500);
      };

      script.onerror = (event) => {
        clearTimeout(timeout);
        logSDKEvent('Tap', 'Script Load Error', { event });
        script.remove();
        tapLoadingRef.current = null;
        reject(new Error('Failed to load Tap SDK - network or server error'));
      };

      logSDKEvent('Tap', 'Appending Script to Document Head');
      document.head.appendChild(script);
    });

    try {
      await tapLoadingRef.current;
      logSDKEvent('Tap', 'Load Completed Successfully');
    } catch (error) {
      tapLoadingRef.current = null;
      logSDKEvent('Tap', 'Load Failed', { error: error.message });
      throw error;
    }

    return tapLoadingRef.current;
  }, []);

  const resetPayPal = useCallback(() => {
    logSDKEvent('PayPal', 'Reset Called');
    const script = document.getElementById('paypal-sdk');
    if (script) {
      script.remove();
    }
    paypalLoadingRef.current = null;
    paypalLoadedRef.current = false;
  }, []);

  const resetTap = useCallback(() => {
    logSDKEvent('Tap', 'Reset Called');
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
