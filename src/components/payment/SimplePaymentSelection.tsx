
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

  useEffect(() => {
    // Load PayPal client ID
    supabase.functions.invoke('paypal-client-id')
      .then(({ data }) => {
        if (data?.clientId) {
          setPaypalClientId(data.clientId);
        }
      })
      .catch(console.error);

    // Load Tap public key
    supabase.functions.invoke('tap-pk')
      .then(({ data }) => {
        if (data?.tapPk) {
          setTapPk(data.tapPk);
        }
      })
      .catch(console.error);
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
      setLoading(true);
      
      await loadPayPalScript();
      
      if (!window.paypal) {
        throw new Error('PayPal SDK failed to load');
      }

      // Create order
      const { data: orderData, error } = await supabase.functions.invoke('paypal-create-order', {
        body: { amount: amount.toString() }
      });

      if (error || !orderData?.id) {
        throw new Error('Failed to create PayPal order');
      }

      // For now, simulate success - in production you'd integrate with PayPal buttons
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
      setLoading(false);
    }
  };

  const handleTapPayment = async () => {
    try {
      setLoading(true);
      
      await loadTapScript();
      
      if (!tapPk) {
        throw new Error('Tap public key not available');
      }

      // Create charge
      const kwdAmount = (amount * 0.307).toFixed(2); // Convert USD to KWD
      const { data: chargeData, error } = await supabase.functions.invoke('tap-create-charge', {
        body: { amount: parseFloat(kwdAmount) }
      });

      if (error) {
        throw new Error('Failed to create Tap charge');
      }

      // For now, simulate success - in production you'd use Tap's lightbox
      toast({
        title: "Tap Payment",
        description: "Tap payment initiated successfully",
      });

      onSuccess({
        paymentId: 'tap_' + Date.now(),
        paymentMethod: 'tap',
        amount: parseFloat(kwdAmount),
        currency: 'KWD'
      });

    } catch (error: any) {
      console.error('Tap payment error:', error);
      onError({ message: error.message || 'Tap payment failed' });
    } finally {
      setLoading(false);
    }
  };

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

        <div className="space-y-3">
          <Button
            onClick={handlePayPalPayment}
            disabled={loading || !paypalClientId}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Pay with PayPal
          </Button>

          <Button
            onClick={handleTapPayment}
            disabled={loading || !tapPk}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Pay with Tap ({(amount * 0.307).toFixed(2)} KWD)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
