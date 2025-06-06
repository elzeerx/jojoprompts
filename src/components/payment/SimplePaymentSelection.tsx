
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface SimplePaymentSelectionProps {
  amount: number;
  planName: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
}

declare global {
  interface Window {
    paypal?: any;
    Tap?: any;
  }
}

export function SimplePaymentSelection({
  amount,
  planName,
  onSuccess,
  onError
}: SimplePaymentSelectionProps) {
  const [loading, setLoading] = useState(false);
  const [paypalClientId, setPaypalClientId] = useState<string | null>(null);
  const [tapPk, setTapPk] = useState<string | null>(null);
  const [paypalLoading, setPaypalLoading] = useState(false);
  const [tapLoading, setTapLoading] = useState(false);

  useEffect(() => {
    const loadPaymentKeys = async () => {
      console.log("Loading payment keys...");
      
      try {
        // Load PayPal client ID
        console.log("Fetching PayPal client ID...");
        const { data: paypalData, error: paypalError } = await supabase.functions.invoke('paypal-client-id');
        console.log("PayPal response:", { data: paypalData, error: paypalError });
        
        if (paypalData?.clientId) {
          setPaypalClientId(paypalData.clientId);
          console.log("PayPal client ID loaded successfully");
        } else {
          console.error("PayPal client ID not found:", paypalError);
        }

        // Load Tap public key
        console.log("Fetching Tap public key...");
        const { data: tapData, error: tapError } = await supabase.functions.invoke('tap-pk');
        console.log("Tap response:", { data: tapData, error: tapError });
        
        if (tapData?.tapPk) {
          setTapPk(tapData.tapPk);
          console.log("Tap public key loaded successfully");
        } else {
          console.error("Tap public key not found:", tapError);
        }
      } catch (error) {
        console.error("Error loading payment keys:", error);
      }
    };

    loadPaymentKeys();
  }, []);

  const loadPayPalScript = async () => {
    if (window.paypal || !paypalClientId) return;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${paypalClientId}&currency=USD`;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const loadTapScript = async () => {
    if (window.Tap) return;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://tap.company/js/pay.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const handlePayPalPayment = async () => {
    try {
      console.log("Starting PayPal payment...");
      setPaypalLoading(true);
      
      await loadPayPalScript();
      
      if (!window.paypal) {
        throw new Error('PayPal SDK failed to load');
      }

      // Create order
      console.log("Creating PayPal order with amount:", amount);
      const { data: orderData, error } = await supabase.functions.invoke('paypal-create-order', {
        body: { amount: amount.toString() }
      });

      console.log("PayPal order response:", { data: orderData, error });

      if (error || !orderData?.id) {
        throw new Error('Failed to create PayPal order');
      }

      toast({
        title: "PayPal Payment",
        description: "PayPal payment initiated successfully",
      });

      onSuccess({
        paymentId: orderData.id,
        paymentMethod: 'paypal',
        amount,
        currency: 'USD'
      });

    } catch (error: any) {
      console.error('PayPal payment error:', error);
      onError({ message: error.message || 'PayPal payment failed' });
    } finally {
      setPaypalLoading(false);
    }
  };

  const handleTapPayment = async () => {
    try {
      console.log("Starting Tap payment...");
      setTapLoading(true);
      
      await loadTapScript();
      
      if (!tapPk) {
        throw new Error('Tap public key not available');
      }

      // Create charge with USD amount (no conversion)
      console.log("Creating Tap charge with USD amount:", amount);
      const { data: chargeData, error } = await supabase.functions.invoke('tap-create-charge', {
        body: { amount }
      });

      console.log("Tap charge response:", { data: chargeData, error });

      if (error) {
        throw new Error('Failed to create Tap charge');
      }

      toast({
        title: "Tap Payment",
        description: "Tap payment initiated successfully",
      });

      onSuccess({
        paymentId: 'tap_' + Date.now(),
        paymentMethod: 'tap',
        amount,
        currency: 'USD'
      });

    } catch (error: any) {
      console.error('Tap payment error:', error);
      onError({ message: error.message || 'Tap payment failed' });
    } finally {
      setTapLoading(false);
    }
  };

  const paypalDisabled = paypalLoading || !paypalClientId;
  const tapDisabled = tapLoading || !tapPk;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose Payment Method</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">Plan: {planName}</p>
          <p className="text-lg font-semibold">${amount} USD</p>
        </div>

        {!paypalClientId && !tapPk && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              Loading payment options...
            </p>
          </div>
        )}

        <div className="space-y-3">
          <Button
            onClick={handlePayPalPayment}
            disabled={paypalDisabled}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {paypalLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Pay with PayPal (${amount} USD)
            {!paypalClientId && !paypalLoading && (
              <span className="ml-2 text-xs">(Loading...)</span>
            )}
          </Button>

          <Button
            onClick={handleTapPayment}
            disabled={tapDisabled}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            {tapLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Pay with Tap (${amount} USD)
            {!tapPk && !tapLoading && (
              <span className="ml-2 text-xs">(Loading...)</span>
            )}
          </Button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-2 bg-gray-100 rounded text-xs">
            <p>Debug Info:</p>
            <p>PayPal Client ID: {paypalClientId ? '✓ Loaded' : '✗ Missing'}</p>
            <p>Tap Public Key: {tapPk ? '✓ Loaded' : '✗ Missing'}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
