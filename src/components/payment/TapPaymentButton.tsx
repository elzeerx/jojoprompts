
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface TapPaymentButtonProps {
  amount: number;
  planName: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
  disabled?: boolean;
}

export function TapPaymentButton({
  amount,
  planName,
  onSuccess,
  onError,
  disabled = false
}: TapPaymentButtonProps) {
  const [loading, setLoading] = useState(false);
  const [tapPk, setTapPk] = useState<string | null>(null);

  useEffect(() => {
    const loadTapPk = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('tap-pk');
        if (data?.tapPk) {
          setTapPk(data.tapPk);
        } else {
          console.error('Failed to load Tap public key:', error);
        }
      } catch (error) {
        console.error('Error loading Tap public key:', error);
      }
    };

    loadTapPk();
  }, []);

  const handleTapPayment = async () => {
    if (!tapPk) {
      onError({ message: 'Tap payment system not available' });
      return;
    }

    try {
      setLoading(true);
      
      // Create charge through the backend
      const { data: chargeData, error } = await supabase.functions.invoke('tap-create-charge', {
        body: { amount }
      });

      if (error) {
        throw new Error('Failed to create Tap charge');
      }

      console.log('Tap charge response:', chargeData);

      // Parse the response to get the redirect URL
      const chargeResponse = typeof chargeData === 'string' ? JSON.parse(chargeData) : chargeData;
      
      if (chargeResponse.transaction?.url) {
        // Redirect to Tap payment page
        window.location.href = chargeResponse.transaction.url;
      } else if (chargeResponse.id) {
        // Store payment info and redirect to success (for testing)
        console.log('Tap charge created:', chargeResponse.id);
        
        toast({
          title: "Redirecting to Tap Payment",
          description: "You'll be redirected to complete your payment.",
        });

        // Simulate success for now - in production, this would come from the redirect URL
        setTimeout(() => {
          onSuccess({
            paymentId: chargeResponse.id,
            paymentMethod: 'tap',
            amount,
            currency: 'USD',
            status: 'completed'
          });
        }, 2000);
      } else {
        throw new Error('Invalid response from Tap payment system');
      }

    } catch (error: any) {
      console.error('Tap payment error:', error);
      onError({ message: error.message || 'Tap payment failed' });
    } finally {
      setLoading(false);
    }
  };

  if (!tapPk) {
    return (
      <Button disabled className="w-full">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading Tap...
      </Button>
    );
  }

  return (
    <Button
      onClick={handleTapPayment}
      disabled={disabled || loading}
      className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : null}
      Pay with Tap (${amount} USD)
    </Button>
  );
}
