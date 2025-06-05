
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

  // Step 1: Load PayPal script when config is available
  useEffect(() => {
    if (paypalConfig && !isScriptLoaded && !scriptError && !configError) {
      console.log("Step 1: Loading PayPal script with config");
      loadPayPalScript(paypalConfig).catch((error) => {
        console.error("Script loading failed:", error);
        handleError(error);
      });
    }
  }, [paypalConfig, isScriptLoaded, scriptError, configError, loadPayPalScript, handleError]);

  // Step 2: Initialize button when script is loaded and config is available
  useEffect(() => {
    if (isScriptLoaded && paypalConfig && !buttonRendered && !buttonError && !configError) {
      console.log("Step 2: Initializing PayPal button");
      // Add small delay to ensure DOM is ready
      setTimeout(() => {
        initializePayPalButton();
      }, 100);
    }
  }, [isScriptLoaded, paypalConfig, buttonRendered, buttonError, configError, initializePayPalButton]);

  const handleRetry = () => {
    console.log("Retrying PayPal initialization");
    resetConfig();
    resetButton();
  };

  const error = configError || scriptError || buttonError;
  const isLoading = configLoading || (paypalConfig && !isScriptLoaded && !error);

  console.log("PayPal Button State:", {
    configLoading,
    hasConfig: !!paypalConfig,
    isScriptLoaded,
    buttonRendered,
    error,
    isLoading
  });

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
