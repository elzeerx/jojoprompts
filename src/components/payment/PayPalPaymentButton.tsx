
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    paypal?: any;
  }
}

interface PayPalPaymentButtonProps {
  amount: number;
  planName: string;
  planId: string;
  userId: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
  disabled?: boolean;
}

export function PayPalPaymentButton({
  amount,
  planName,
  planId,
  userId,
  onSuccess,
  onError,
  disabled = false
}: PayPalPaymentButtonProps) {
  const paypalRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);

  // Detect if popup blockers might interfere
  const detectPopupBlocker = (): boolean => {
    try {
      const popup = window.open('', '_blank', 'width=1,height=1');
      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        return true;
      }
      popup.close();
      return false;
    } catch (e) {
      return true;
    }
  };

  // Get PayPal client ID
  useEffect(() => {
    const getPayPalClientId = async () => {
      try {
        console.log('[PayPal] Fetching client ID...');
        const { data, error } = await supabase.functions.invoke('get-paypal-client-id');
        
        if (error) {
          console.error('[PayPal] Failed to get client ID:', error);
          setError('Failed to initialize PayPal payment system');
          return;
        }
        
        console.log('[PayPal] Client ID received successfully');
        setClientId(data.clientId);
      } catch (error) {
        console.error('[PayPal] Error getting client ID:', error);
        setError('Payment system unavailable');
      }
    };

    getPayPalClientId();
  }, []);

  // Load PayPal SDK with improved configuration
  useEffect(() => {
    if (!clientId || error) return;

    const loadPayPalScript = () => {
      if (window.paypal) {
        console.log('[PayPal] SDK already loaded');
        setScriptLoaded(true);
        setIsLoading(false);
        return;
      }

      console.log('[PayPal] Loading SDK...');
      
      // Remove any existing PayPal scripts
      const existingScripts = document.querySelectorAll('script[src*="paypal.com/sdk"]');
      existingScripts.forEach(script => script.remove());

      const script = document.createElement('script');
      // Improved SDK URL without problematic disable-funding parameters
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&components=buttons&intent=capture&locale=en_US&buyer-country=US`;
      script.async = true;
      
      script.onload = () => {
        console.log('[PayPal] SDK loaded successfully');
        if (window.paypal) {
          setScriptLoaded(true);
          setIsLoading(false);
          
          // Check for popup blocker
          if (detectPopupBlocker()) {
            console.warn('[PayPal] Popup blocker detected');
            setPopupBlocked(true);
          }
        } else {
          setError('PayPal SDK failed to initialize properly');
        }
      };
      
      script.onerror = () => {
        console.error('[PayPal] Failed to load SDK');
        setError('Failed to load PayPal payment system');
        setIsLoading(false);
      };
      
      document.head.appendChild(script);
    };

    // Add small delay to ensure DOM is ready
    setTimeout(loadPayPalScript, 100);
  }, [clientId, error]);

  // Initialize PayPal buttons with enhanced configuration
  useEffect(() => {
    if (!scriptLoaded || !window.paypal || !paypalRef.current || disabled || error) {
      return;
    }

    console.log('[PayPal] Initializing payment buttons...');
    
    // Clear any existing buttons
    if (paypalRef.current) {
      paypalRef.current.innerHTML = '';
    }

    let retryCount = 0;
    const maxRetries = 3;

    const initializeButtons = () => {
      try {
        const buttons = window.paypal.Buttons({
          style: {
            color: 'gold',
            shape: 'rect',
            label: 'paypal',
            height: 50,
            layout: 'vertical',
            tagline: false
          },
          
          createOrder: async () => {
            try {
              console.log('[PayPal] === Creating Order ===');
              setIsProcessing(true);
              
              const { data, error } = await supabase.functions.invoke('create-paypal-order', {
                body: { planId, userId, amount }
              });

              if (error) {
                console.error('[PayPal] Order creation failed:', error);
                throw new Error(error.message || 'Failed to create payment order');
              }

              if (!data?.success || !data?.id) {
                console.error('[PayPal] Invalid order response:', data);
                throw new Error(data?.error || 'Invalid payment order response');
              }

              console.log('[PayPal] Order created successfully:', data.id);
              return data.id;
            } catch (error) {
              console.error('[PayPal] Create order error:', error);
              setIsProcessing(false);
              onError(error);
              throw error;
            }
          },

          onApprove: async (data: any) => {
            try {
              console.log('[PayPal] === Processing Payment ===');
              
              const { data: captureData, error: captureError } = await supabase.functions.invoke('capture-paypal-payment', {
                body: {
                  orderId: data.orderID,
                  planId,
                  userId
                }
              });

              if (captureError) {
                console.error('[PayPal] Payment capture failed:', captureError);
                throw new Error(captureError.message || 'Payment processing failed');
              }

              if (!captureData?.success) {
                console.error('[PayPal] Payment capture unsuccessful:', captureData);
                throw new Error(captureData?.error || 'Payment was not completed successfully');
              }

              console.log('[PayPal] Payment completed successfully');
              setIsProcessing(false);

              onSuccess({
                paymentMethod: 'paypal',
                paymentId: captureData.captureId,
                orderId: data.orderID,
                status: captureData.status,
                payerEmail: captureData.payerEmail,
                details: {
                  id: captureData.captureId,
                  status: captureData.status,
                  amount: amount
                }
              });

            } catch (error) {
              console.error('[PayPal] Payment approval error:', error);
              setIsProcessing(false);
              onError(error);
            }
          },

          onCancel: (data: any) => {
            console.log('[PayPal] Payment cancelled by user');
            setIsProcessing(false);
            onError(new Error('Payment was cancelled by user'));
          },

          onError: (err: any) => {
            console.error('[PayPal] Payment error:', err);
            setIsProcessing(false);
            
            // Check if it's a popup blocker issue
            if (err?.message?.includes('popup') || err?.message?.includes('blocked')) {
              setShowFallback(true);
              setPopupBlocked(true);
            }
            
            onError(err);
          }
        });

        // Render buttons with retry mechanism
        buttons.render(paypalRef.current).then(() => {
          console.log('[PayPal] Buttons rendered successfully');
        }).catch((err: any) => {
          console.error('[PayPal] Button render error:', err);
          
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`[PayPal] Retrying button initialization (${retryCount}/${maxRetries})`);
            setTimeout(initializeButtons, 1000);
          } else {
            setError('Unable to initialize PayPal payment buttons');
          }
        });

      } catch (error) {
        console.error('[PayPal] Button initialization error:', error);
        
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(initializeButtons, 1000);
        } else {
          setError('Failed to initialize PayPal payment system');
        }
      }
    };

    // Initialize with small delay to ensure DOM is ready
    setTimeout(initializeButtons, 200);
  }, [scriptLoaded, disabled, amount, planId, userId, onSuccess, onError, error]);

  // Handle fallback payment flow (redirect-based)
  const handleFallbackPayment = async () => {
    try {
      setIsProcessing(true);
      console.log('[PayPal] Starting fallback payment flow...');
      
      const { data, error } = await supabase.functions.invoke('create-paypal-order', {
        body: { planId, userId, amount }
      });

      if (error || !data?.success) {
        throw new Error(error?.message || 'Failed to create payment order');
      }

      // Redirect to PayPal for payment (fallback method)
      const paypalUrl = `https://www.paypal.com/checkoutnow?token=${data.id}`;
      window.location.href = paypalUrl;
      
    } catch (error) {
      console.error('[PayPal] Fallback payment error:', error);
      setIsProcessing(false);
      onError(error);
    }
  };

  if (error) {
    return (
      <div className="w-full p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-start gap-2 mb-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-red-800 font-medium">Payment System Error</p>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          className="w-full" 
          onClick={() => window.location.reload()}
        >
          Retry Payment Setup
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <span className="text-gray-700">Setting up PayPal payment...</span>
        </div>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="w-full p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <span className="text-blue-700 font-medium">Processing your payment...</span>
        </div>
        <p className="text-blue-600 text-sm text-center mt-2">
          Please do not close this window
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Popup blocker warning */}
      {popupBlocked && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="text-yellow-800 font-medium">Popup Blocked</p>
              <p className="text-yellow-700 mt-1">
                Your browser may be blocking PayPal popups. Use the alternative payment button below if needed.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main PayPal buttons */}
      <div className="relative">
        <div ref={paypalRef} className="min-h-[50px]" />
        {disabled && (
          <div className="absolute inset-0 bg-gray-200 bg-opacity-50 flex items-center justify-center rounded">
            <span className="text-gray-600">Processing...</span>
          </div>
        )}
      </div>

      {/* Fallback payment option */}
      {(showFallback || popupBlocked) && (
        <div className="border-t pt-4">
          <p className="text-sm text-gray-600 mb-3 text-center">
            Having trouble with the payment popup? Try this alternative:
          </p>
          <Button
            onClick={handleFallbackPayment}
            disabled={isProcessing || disabled}
            className="w-full bg-[#0070ba] hover:bg-[#005ea6] text-white"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Pay with PayPal (Opens in New Window)
          </Button>
        </div>
      )}

      {/* Security notice */}
      <div className="text-xs text-gray-500 text-center">
        <p>🔒 Secure payment powered by PayPal</p>
      </div>
    </div>
  );
}
