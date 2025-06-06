
import React, { useState, useEffect } from 'react';
import { EnhancedPayPalPayment } from './EnhancedPayPalPayment';
import { EnhancedTapPayment } from './EnhancedTapPayment';
import { PayPalPayment } from './PayPalPayment';
import { TapPayment } from './TapPayment';
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface PaymentGatewayManagerProps {
  amount: number;
  planName: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
  onStart?: () => void;
  useEnhanced?: boolean;
}

export function PaymentGatewayManager({ 
  amount, 
  planName, 
  onSuccess, 
  onError, 
  onStart,
  useEnhanced = false
}: PaymentGatewayManagerProps) {
  const [selectedGateway, setSelectedGateway] = useState<string | null>(null);
  const [availableGateways, setAvailableGateways] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    checkAvailableGateways();
  }, []);

  const checkAvailableGateways = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('available-payment-methods');

      if (error) {
        console.error('Failed to check available gateways:', error);
        // Fallback to default gateways
        setAvailableGateways(['PayPal', 'Tap']);
      } else if (data?.methods) {
        setAvailableGateways(data.methods);
        
        // Auto-select if only one gateway available
        if (data.methods.length === 1) {
          setSelectedGateway(data.methods[0]);
        }
      } else {
        setAvailableGateways(['PayPal', 'Tap']);
      }
    } catch (error) {
      console.error('Failed to check available gateways:', error);
      setAvailableGateways(['PayPal', 'Tap']);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = (result: any) => {
    // Log successful payment
    logPaymentEvent('success', selectedGateway, result);
    onSuccess(result);
  };

  const handlePaymentError = (error: any) => {
    // Log failed payment
    logPaymentEvent('error', selectedGateway, error);
    
    // Attempt fallback to other gateway
    if (availableGateways.length > 1) {
      const otherGateway = availableGateways.find(g => g !== selectedGateway);
      if (otherGateway && window.confirm(`Payment failed with ${selectedGateway}. Try with ${otherGateway}?`)) {
        setSelectedGateway(otherGateway);
        return;
      }
    }
    
    onError(error);
  };

  const logPaymentEvent = async (type: string, gateway: string | null, data: any) => {
    try {
      await supabase.functions.invoke('log-payment-event', {
        body: {
          type,
          gateway,
          amount,
          userId: user?.id,
          timestamp: new Date().toISOString(),
          data
        }
      });
    } catch (error) {
      console.error('Failed to log payment event:', error);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-32 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading payment options...</span>
      </div>
    );
  }

  if (availableGateways.length === 0) {
    return (
      <div className="w-full p-4 bg-red-50 border border-red-200 rounded-lg text-center">
        <p className="text-red-800">No payment methods available. Please contact support.</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {availableGateways.length > 1 && !selectedGateway && (
        <div className="text-center space-y-4">
          <h3 className="text-lg font-semibold">Select Payment Method</h3>
          <div className="flex gap-4 justify-center">
            {availableGateways.map(gateway => (
              <Button
                key={gateway}
                onClick={() => setSelectedGateway(gateway)}
                variant="outline"
                className="flex flex-col items-center gap-2 h-auto p-4"
              >
                <span className="text-2xl">
                  {gateway === 'PayPal' ? '💳' : '🏦'}
                </span>
                <span>Pay with {gateway}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {selectedGateway === 'PayPal' && (
        useEnhanced ? (
          <EnhancedPayPalPayment
            amount={amount}
            planName={planName}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
            onStart={onStart}
            onCancel={() => setSelectedGateway(null)}
          />
        ) : (
          <PayPalPayment
            amount={amount}
            planName={planName}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
            onStart={onStart}
          />
        )
      )}

      {selectedGateway === 'Tap' && (
        useEnhanced ? (
          <EnhancedTapPayment
            amount={amount}
            planName={planName}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
            onStart={onStart}
          />
        ) : (
          <TapPayment
            amount={amount}
            planName={planName}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
            onStart={onStart}
          />
        )
      )}

      {selectedGateway && availableGateways.length > 1 && (
        <div className="text-center">
          <Button
            onClick={() => setSelectedGateway(null)}
            variant="ghost"
            size="sm"
          >
            Change payment method
          </Button>
        </div>
      )}
    </div>
  );
}
