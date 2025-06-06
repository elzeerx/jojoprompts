
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface TapPaymentButtonProps {
  amount: number;
  planName: string;
  planId: string;
  userId: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
  disabled?: boolean;
}

export function TapPaymentButton({
  amount,
  planName,
  planId,
  userId,
  onSuccess,
  onError,
  disabled = false
}: TapPaymentButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleTapPayment = async () => {
    if (!userId) {
      onError({ message: 'Please log in to continue with payment' });
      return;
    }

    try {
      setLoading(true);
      
      toast({
        title: "Initializing Payment",
        description: "Redirecting to Tap Payment Gateway...",
      });

      // Create payment charge through Tap API
      const { data: paymentData, error } = await supabase.functions.invoke('create-tap-payment', {
        body: { 
          planId,
          userId,
          amount,
          currency: 'USD'
        }
      });

      if (error) {
        console.error('Tap payment creation error:', error);
        throw new Error('Failed to initialize payment');
      }

      if (!paymentData) {
        throw new Error('No payment data received');
      }

      // Check if we have a redirect URL from Tap
      if (paymentData.transaction?.url) {
        // Redirect to Tap payment page
        window.location.href = paymentData.transaction.url;
      } else {
        throw new Error('No payment URL received from Tap');
      }

    } catch (error: any) {
      console.error('Payment initialization error:', error);
      
      let errorMessage = 'Failed to initialize payment. Please try again.';
      if (error.message?.includes('network')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message?.includes('authentication')) {
        errorMessage = 'Authentication error. Please refresh the page and try again.';
      }
      
      toast({
        title: "Payment Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      onError({ message: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleTapPayment}
      disabled={disabled || loading}
      className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white"
      size="lg"
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Redirecting to Payment...
        </>
      ) : (
        <>
          <CreditCard className="h-4 w-4 mr-2" />
          Pay ${amount} USD with Tap
        </>
      )}
    </Button>
  );
}
