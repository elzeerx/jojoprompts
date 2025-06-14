
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
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
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const addDebugInfo = (info: string) => {
    console.log(`[PayPal Debug] ${info}`);
    setDebugInfo(prev => [...prev, `${new Date().toISOString()}: ${info}`]);
  };

  // Get PayPal client ID
  useEffect(() => {
    const getPayPalClientId = async () => {
      try {
        addDebugInfo('Fetching PayPal client ID...');
        const { data, error } = await supabase.functions.invoke('get-paypal-client-id');
        
        if (error) {
          addDebugInfo(`Failed to get PayPal client ID: ${error.message}`);
          setError('Failed to initialize PayPal');
          return;
        }
        
        addDebugInfo(`PayPal client ID received: ${data.clientId ? 'Yes' : 'No'}`);
        setClientId(data.clientId);
      } catch (error) {
        addDebugInfo(`Error getting PayPal client ID: ${error}`);
        setError('Failed to initialize PayPal');
      }
    };

    getPayPalClientId();
  }, []);

  // Load PayPal SDK
  useEffect(() => {
    if (!clientId || error) return;

    const loadPayPalScript = () => {
      if (window.paypal) {
        addDebugInfo('PayPal SDK already loaded');
        setScriptLoaded(true);
        setIsLoading(false);
        return;
      }

      addDebugInfo(`Loading PayPal SDK with client ID: ${clientId.substring(0, 20)}...`);
      
      // Remove any existing PayPal scripts
      const existingScript = document.querySelector('script[src*="paypal.com/sdk"]');
      if (existingScript) {
        existingScript.remove();
        addDebugInfo('Removed existing PayPal script');
      }

      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&components=buttons&intent=capture&disable-funding=credit,card`;
      script.async = true;
      
      script.onload = () => {
        addDebugInfo('PayPal SDK loaded successfully');
        if (window.paypal) {
          addDebugInfo('PayPal object is available');
          setScriptLoaded(true);
          setIsLoading(false);
        } else {
          addDebugInfo('PayPal object not available after script load');
          setError('PayPal SDK failed to initialize');
        }
      };
      
      script.onerror = (e) => {
        addDebugInfo(`Failed to load PayPal SDK: ${e}`);
        setError('Failed to load PayPal SDK');
        setIsLoading(false);
      };
      
      document.head.appendChild(script);
    };

    loadPayPalScript();
  }, [clientId, error]);

  // Initialize PayPal buttons
  useEffect(() => {
    if (!scriptLoaded || !window.paypal || !paypalRef.current || disabled || error) {
      addDebugInfo(`Button init skipped: scriptLoaded=${scriptLoaded}, paypal=${!!window.paypal}, ref=${!!paypalRef.current}, disabled=${disabled}, error=${!!error}`);
      return;
    }

    addDebugInfo('Initializing PayPal buttons...');
    
    // Clear any existing buttons
    if (paypalRef.current) {
      paypalRef.current.innerHTML = '';
    }

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
            addDebugInfo('=== PayPal createOrder started ===');
            setIsProcessing(true);
            
            const { data, error } = await supabase.functions.invoke('create-paypal-order', {
              body: {
                planId,
                userId,  
                amount
              }
            });

            addDebugInfo(`Create order response: ${JSON.stringify({ success: data?.success, error: error?.message })}`);

            if (error) {
              addDebugInfo(`Error creating PayPal order: ${error.message}`);
              throw new Error(error.message || 'Failed to create PayPal order');
            }

            if (!data || !data.success || !data.id) {
              addDebugInfo(`Invalid order response: ${JSON.stringify(data)}`);
              throw new Error(data?.error || 'Invalid order response from server');
            }

            addDebugInfo(`PayPal order created successfully: ${data.id}`);
            return data.id;
          } catch (error) {
            addDebugInfo(`Error in createOrder: ${error}`);
            setIsProcessing(false);
            onError(error);
            throw error;
          }
        },

        onApprove: async (data: any) => {
          try {
            addDebugInfo('=== PayPal onApprove started ===');
            addDebugInfo(`Approval data: ${JSON.stringify(data)}`);
            
            const { data: captureData, error: captureError } = await supabase.functions.invoke('capture-paypal-payment', {
              body: {
                orderId: data.orderID,
                planId,
                userId
              }
            });

            addDebugInfo(`Capture response: ${JSON.stringify({ success: captureData?.success, error: captureError?.message })}`);

            if (captureError) {
              addDebugInfo(`Error capturing payment: ${captureError.message}`);
              throw new Error(captureError.message || 'Failed to capture payment');
            }

            if (!captureData || !captureData.success) {
              addDebugInfo(`Payment capture failed: ${JSON.stringify(captureData)}`);
              throw new Error(captureData?.error || 'Payment capture was unsuccessful');
            }

            addDebugInfo('Payment captured successfully');
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
            addDebugInfo(`Error in onApprove: ${error}`);
            setIsProcessing(false);
            onError(error);
          }
        },

        onCancel: (data: any) => {
          addDebugInfo(`PayPal payment cancelled: ${JSON.stringify(data)}`);
          setIsProcessing(false);
          onError(new Error('Payment was cancelled'));
        },

        onError: (err: any) => {
          addDebugInfo(`PayPal payment error: ${JSON.stringify(err)}`);
          setIsProcessing(false);
          onError(err);
        }
      });

      // Render the buttons with error handling
      buttons.render(paypalRef.current).then(() => {
        addDebugInfo('PayPal buttons rendered successfully');
      }).catch((err: any) => {
        addDebugInfo(`Error rendering PayPal buttons: ${JSON.stringify(err)}`);
        setError('Failed to render PayPal buttons');
      });

    } catch (error) {
      addDebugInfo(`Error initializing PayPal buttons: ${error}`);
      setError('Failed to initialize PayPal buttons');
    }
  }, [scriptLoaded, disabled, amount, planId, userId, onSuccess, onError, error]);

  if (error) {
    return (
      <div className="w-full p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800 text-sm mb-2">{error}</p>
        <details className="mb-2">
          <summary className="text-xs text-red-600 cursor-pointer">Debug Info</summary>
          <div className="mt-2 text-xs text-red-600 max-h-32 overflow-y-auto">
            {debugInfo.map((info, i) => (
              <div key={i}>{info}</div>
            ))}
          </div>
        </details>
        <Button 
          variant="outline" 
          className="mt-2 w-full" 
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full">
        <Button disabled className="w-full">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading PayPal...
        </Button>
        <details className="mt-2">
          <summary className="text-xs text-gray-600 cursor-pointer">Debug Info</summary>
          <div className="mt-2 text-xs text-gray-600 max-h-32 overflow-y-auto">
            {debugInfo.map((info, i) => (
              <div key={i}>{info}</div>
            ))}
          </div>
        </details>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="w-full">
        <Button disabled className="w-full">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Processing Payment...
        </Button>
        <details className="mt-2">
          <summary className="text-xs text-gray-600 cursor-pointer">Debug Info</summary>
          <div className="mt-2 text-xs text-gray-600 max-h-32 overflow-y-auto">
            {debugInfo.map((info, i) => (
              <div key={i}>{info}</div>
            ))}
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className="w-full relative">
      <div ref={paypalRef} className="min-h-[50px]" />
      {disabled && (
        <div className="absolute inset-0 bg-gray-200 bg-opacity-50 flex items-center justify-center rounded">
          <span className="text-gray-600">Payment processing...</span>
        </div>
      )}
      <details className="mt-2">
        <summary className="text-xs text-gray-600 cursor-pointer">Debug Info</summary>
        <div className="mt-2 text-xs text-gray-600 max-h-32 overflow-y-auto">
          {debugInfo.map((info, i) => (
            <div key={i}>{info}</div>
          ))}
        </div>
      </details>
    </div>
  );
}
