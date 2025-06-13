
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard, Shield } from 'lucide-react';
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
        title: "Initializing Secure Payment",
        description: "Connecting to Tap Payment Gateway...",
      });

      console.log('Initiating Tap payment:', { planId, userId, amount });

      // Call the create-tap-charge edge function
      const { data: userData } = await supabase.auth.getUser();
      
      const res = await supabase.functions.invoke('create-tap-charge', {
        body: { 
          user_id: userData.user?.id || userId, 
          amount 
        }
      });

      if (res.error) {
        console.error('Tap payment creation error:', res.error);
        throw new Error(res.error.message || 'Failed to initialize payment');
      }

      if (!res.data || !res.data.url) {
        throw new Error('No payment URL received from gateway');
      }

      console.log('Tap payment response received:', res.data);
      
      // Store payment info for verification
      const pendingPayment = {
        planId,
        userId,
        amount,
        currency: 'USD',
        timestamp: Date.now()
      };
      
      localStorage.setItem('pending_payment', JSON.stringify(pendingPayment));
      
      // Show final confirmation before redirect
      toast({
        title: "Redirecting to Payment",
        description: "You will be redirected to complete your secure payment.",
      });
      
      // Small delay for better UX
      setTimeout(() => {
        window.location.href = res.data.url;
      }, 1000);

    } catch (error: any) {
      console.error('Payment initialization error:', error);
      
      let errorMessage = 'Failed to initialize payment. Please try again.';
      
      if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message?.includes('authentication') || error.message?.includes('unauthorized')) {
        errorMessage = 'Authentication error. Please refresh the page and try again.';
      } else if (error.message?.includes('Payment service not')) {
        errorMessage = 'Payment service temporarily unavailable. Please try again later.';
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
    <div className="space-y-3">
      <Button
        onClick={handleTapPayment}
        disabled={disabled || loading}
        className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white"
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Connecting to Tap...
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4 mr-2" />
            Pay ${amount} USD with Tap
          </>
        )}
      </Button>
      
      {/* Security notice */}
      <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
        <Shield className="h-3 w-3" />
        <span>Secured by Tap Payment Gateway</span>
      </div>
    </div>
  );
}
