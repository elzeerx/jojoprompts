
import { useState, useRef } from 'react';
import { supabase } from "@/integrations/supabase/client";

export function usePayPalScriptLoader() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const scriptLoadedRef = useRef(false);
  const componentMountedRef = useRef(true);

  const logPayPalEvent = (event: string, data?: any) => {
    console.log(`[PayPal Payment] ${event}:`, {
      timestamp: new Date().toISOString(),
      ...data
    });
  };

  const loadPayPalScript = async (amount: number, planName: string, onUnavailable?: (reason: string) => void) => {
    if (window.paypal && scriptLoadedRef.current) {
      setReady(true);
      return;
    }

    if (!componentMountedRef.current) return;

    setLoading(true);
    setError(null);
    logPayPalEvent('Script Loading Started', { amount, planName });

    try {
      const { data: config, error: configError } = await supabase.functions.invoke('get-paypal-config');

      if (!componentMountedRef.current) return;

      if (configError) {
        throw new Error(`Configuration error: ${configError.message}`);
      }

      if (!config?.clientId) {
        const errorMessage = 'PayPal configuration not available';
        logPayPalEvent('Configuration Error', { error: errorMessage });
        onUnavailable?.(errorMessage);
        throw new Error(errorMessage);
      }

      // Remove existing PayPal script if any
      const existingScript = document.querySelector('script[src*="paypal.com/sdk"]');
      if (existingScript) {
        existingScript.remove();
        logPayPalEvent('Existing Script Removed');
      }

      // Load PayPal script
      const script = document.createElement('script');
      const environment = config.environment === 'production' ? '' : '.sandbox';
      script.src = `https://www${environment}.paypal.com/sdk/js?client-id=${config.clientId}&currency=USD&intent=capture`;
      
      script.onload = () => {
        if (!componentMountedRef.current) return;
        logPayPalEvent('Script Loaded Successfully');
        scriptLoadedRef.current = true;
        setReady(true);
        setLoading(false);
      };
      
      script.onerror = () => {
        if (!componentMountedRef.current) return;
        const errorMessage = 'Failed to load PayPal payment system';
        logPayPalEvent('Script Load Error', { error: errorMessage });
        setError(errorMessage);
        setLoading(false);
        onUnavailable?.(errorMessage);
      };
      
      document.head.appendChild(script);
      
    } catch (error: any) {
      if (!componentMountedRef.current) return;
      logPayPalEvent('Initialization Error', { error: error.message });
      setError(error.message || 'Failed to initialize PayPal');
      setLoading(false);
    }
  };

  const cleanup = () => {
    componentMountedRef.current = false;
    logPayPalEvent('Component Unmounted');
  };

  const isComponentMounted = () => componentMountedRef.current;

  return {
    loading,
    error,
    ready,
    loadPayPalScript,
    cleanup,
    isComponentMounted,
    logPayPalEvent
  };
}
