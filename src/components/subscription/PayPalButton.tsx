
import React, { useEffect, useCallback } from "react";
import { usePayPalConfig } from "./hooks/usePayPalConfig";
import { usePayPalScript } from "./hooks/usePayPalScript";
import { usePayPalButton } from "./hooks/usePayPalButton";
import { PayPalErrorDisplay } from "./components/PayPalErrorDisplay";
import { PayPalLoadingDisplay } from "./components/PayPalLoadingDisplay";

declare global {
  interface Window {
    paypal?: any;
  }
}

interface PayPalButtonProps {
  amount: number;
  planName: string;
  className?: string;
  onSuccess: (paymentId: string, details: any) => void;
  onError?: (error: any) => void;
}

export function PayPalButton({ 
  amount, 
  planName, 
  className = "", 
  onSuccess, 
  onError = (error) => console.error("PayPal error:", error) 
}: PayPalButtonProps) {
  const { paypalConfig, error: configError, isLoading: configLoading, resetConfig } = usePayPalConfig();
  const { isScriptLoaded, scriptError, loadPayPalScript } = usePayPalScript();
  
  const handleSuccess = useCallback((paymentId: string, details: any) => {
    console.log("PayPal payment successful:", { paymentId, details });
    onSuccess(paymentId, details);
  }, [onSuccess]);

  const handleError = useCallback((error: any) => {
    console.error("PayPal payment error:", error);
    const errorMessage = typeof error === 'string' ? error : error?.message || "PayPal payment failed";
    onError(error);
  }, [onError]);

  const { 
    paypalRef, 
    buttonRendered, 
    buttonError, 
    initializePayPalButton, 
    resetButton 
  } = usePayPalButton({
    amount,
    planName,
    onSuccess: handleSuccess,
    onError: handleError,
    paypalConfig: paypalConfig!
  });

  // Load PayPal script when config is available
  useEffect(() => {
    if (paypalConfig && !isScriptLoaded && !scriptError) {
      loadPayPalScript(paypalConfig).catch((error) => {
        console.error("Script loading failed:", error);
        handleError(error);
      });
    }
  }, [paypalConfig, isScriptLoaded, scriptError, loadPayPalScript, handleError]);

  // Initialize button when script is loaded
  useEffect(() => {
    if (isScriptLoaded && paypalConfig && !buttonRendered && !buttonError) {
      initializePayPalButton();
    }
  }, [isScriptLoaded, paypalConfig, buttonRendered, buttonError, initializePayPalButton]);

  // Fetch config on mount
  useEffect(() => {
    if (!paypalConfig && !configError && configLoading) {
      // Config fetching is handled by the hook
    }
  }, [paypalConfig, configError, configLoading]);

  const handleRetry = () => {
    resetConfig();
    resetButton();
  };

  const error = configError || scriptError || buttonError;
  const isLoading = configLoading || (!isScriptLoaded && !error);

  if (error) {
    return (
      <PayPalErrorDisplay 
        error={error} 
        onRetry={handleRetry} 
        className={className} 
      />
    );
  }

  return (
    <div className={`w-full ${className}`}>
      {isLoading && <PayPalLoadingDisplay />}
      <div 
        ref={paypalRef} 
        className={`paypal-button-container ${isLoading ? 'hidden' : ''}`}
        style={{ minHeight: isLoading ? '0' : '45px' }}
      />
    </div>
  );
}
