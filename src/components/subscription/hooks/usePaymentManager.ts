
import { useState, useCallback, useEffect } from 'react';
import { usePayPalConfig } from './usePayPalConfig';
import { usePayPalScript } from './usePayPalScript';
import { useNetworkDiagnostics } from './useNetworkDiagnostics';

interface PaymentManagerState {
  paypalReady: boolean;
  tapReady: boolean;
  paypalError: string | null;
  tapError: string | null;
  isInitializing: boolean;
}

export function usePaymentManager() {
  const [state, setState] = useState<PaymentManagerState>({
    paypalReady: false,
    tapReady: false,
    paypalError: null,
    tapError: null,
    isInitializing: true
  });

  const { paypalConfig, error: configError, isLoading: configLoading } = usePayPalConfig();
  const { isScriptLoaded, scriptError, loadPayPalScript } = usePayPalScript();
  const { runConnectivityTests } = useNetworkDiagnostics();

  // Initialize PayPal when config is available
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const initializePayPal = async () => {
      if (paypalConfig && !isScriptLoaded && !scriptError && !configError) {
        try {
          console.log("PaymentManager: Initializing PayPal...");
          await loadPayPalScript(paypalConfig);
          
          // Wait for PayPal to be fully available
          timeoutId = setTimeout(() => {
            if (window.paypal) {
              setState(prev => ({ ...prev, paypalReady: true, paypalError: null }));
              console.log("PaymentManager: PayPal ready");
            } else {
              setState(prev => ({ ...prev, paypalError: "PayPal failed to initialize properly" }));
            }
          }, 1000);
        } catch (error: any) {
          console.error("PaymentManager: PayPal initialization failed:", error);
          setState(prev => ({ ...prev, paypalError: error.message }));
        }
      } else if (configError || scriptError) {
        setState(prev => ({ ...prev, paypalError: configError || scriptError }));
      }
    };

    initializePayPal();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [paypalConfig, isScriptLoaded, scriptError, configError, loadPayPalScript]);

  // Initialize Tap Payment readiness check
  useEffect(() => {
    const checkTapReadiness = async () => {
      try {
        console.log("PaymentManager: Checking Tap readiness...");
        const results = await runConnectivityTests();
        setState(prev => ({ 
          ...prev, 
          tapReady: results.tap === true,
          tapError: results.tap === false ? "Tap Payment service is not available" : null
        }));
      } catch (error: any) {
        console.error("PaymentManager: Tap readiness check failed:", error);
        setState(prev => ({ ...prev, tapError: "Failed to check Tap Payment availability" }));
      }
    };

    // Only check Tap after a brief delay to avoid overwhelming the system
    const timeoutId = setTimeout(checkTapReadiness, 2000);
    return () => clearTimeout(timeoutId);
  }, [runConnectivityTests]);

  // Update initialization status
  useEffect(() => {
    const isStillInitializing = configLoading || (!state.paypalReady && !state.paypalError && !state.tapReady && !state.tapError);
    setState(prev => ({ ...prev, isInitializing: isStillInitializing }));
  }, [configLoading, state.paypalReady, state.paypalError, state.tapReady, state.tapError]);

  const retryPayPal = useCallback(() => {
    console.log("PaymentManager: Retrying PayPal...");
    setState(prev => ({ ...prev, paypalError: null, paypalReady: false }));
    // The useEffect will handle re-initialization
  }, []);

  const retryTap = useCallback(async () => {
    console.log("PaymentManager: Retrying Tap...");
    setState(prev => ({ ...prev, tapError: null, tapReady: false }));
    
    try {
      const results = await runConnectivityTests();
      setState(prev => ({ 
        ...prev, 
        tapReady: results.tap === true,
        tapError: results.tap === false ? "Tap Payment service is not available" : null
      }));
    } catch (error: any) {
      setState(prev => ({ ...prev, tapError: error.message }));
    }
  }, [runConnectivityTests]);

  return {
    ...state,
    hasAnyPaymentMethod: state.paypalReady || state.tapReady,
    retryPayPal,
    retryTap
  };
}
