
import React from "react";
import { usePayPalButton } from "./hooks/usePayPalButton";
import { usePaymentManager } from "./hooks/usePaymentManager";
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
  const { paypalReady, paypalError, isInitializing, retryPayPal } = usePaymentManager();

  const { 
    paypalRef, 
    buttonRendered, 
    buttonError, 
    initializePayPalButton 
  } = usePayPalButton({
    amount,
    planName,
    onSuccess,
    onError,
    paypalConfig: { clientId: '', environment: 'sandbox', currency: 'USD' } // Will be ignored when using payment manager
  });

  // Initialize button when PayPal is ready
  React.useEffect(() => {
    if (paypalReady && !buttonRendered && !buttonError) {
      console.log("PayPal ready, initializing button...");
      setTimeout(() => {
        initializePayPalButton();
      }, 100);
    }
  }, [paypalReady, buttonRendered, buttonError, initializePayPalButton]);

  const error = paypalError || buttonError;
  const isLoading = isInitializing || (paypalReady && !buttonRendered && !error);

  console.log("PayPal Button State:", {
    paypalReady,
    isInitializing,
    buttonRendered,
    error,
    isLoading
  });

  if (error) {
    return (
      <PayPalErrorDisplay 
        error={error} 
        onRetry={retryPayPal} 
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
