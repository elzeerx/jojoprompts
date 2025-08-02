
import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, ArrowRight, CheckCircle } from 'lucide-react';
import { SessionManager } from '@/hooks/payment/helpers/sessionManager';

interface SimplePayPalButtonProps {
  amount: number;
  planId: string;
  userId: string;
  onSuccess: (data: any) => void;
  onError: (error: any) => void;
  appliedDiscount?: {
    id: string;
    code: string;
    discount_type: string;
    discount_value: number;
  } | null;
}

export function SimplePayPalButton({ 
  amount, 
  planId, 
  userId, 
  onSuccess, 
  onError,
  appliedDiscount
}: SimplePayPalButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  // Amount is already final amount after discount calculation from PaymentMethodsCard
  // NO FURTHER DISCOUNT CALCULATIONS SHOULD BE DONE HERE
  const finalAmount = amount;
  const is100PercentDiscount = finalAmount === 0;

  // Logging will be handled by the payment processing functions

  const handleDirectActivation = async () => {
    setIsProcessing(true);
    try {
      // Processing 100% discount direct activation

      const { data, error } = await supabase.functions.invoke("process-paypal-payment", {
        body: {
          action: "direct-activation",
          planId,
          userId,
          amount: finalAmount,
          appliedDiscount
        }
      });

      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || "Failed to activate subscription with discount.");
      }

      // Success handled by onSuccess callback

      onSuccess({
        status: 'COMPLETED',
        transactionId: data.transactionId,
        subscriptionId: data.subscriptionId,
        paymentId: data.paymentId || data.paymentMethod,
        paymentMethod: 'discount_100_percent'
      });

      toast({
        title: "Success!",
        description: "Your subscription has been activated with the discount!",
        variant: "default"
      });

    } catch (err: any) {
      console.error('Direct activation failed:', err);
      setIsProcessing(false);
      onError(err);
      toast({
        title: "Error",
        description: err.message || "Subscription activation failed.",
        variant: "destructive"
      });
    }
  };

  const handlePayPalRedirect = async () => {
    setIsProcessing(true);
    try {
      // PayPal checkout initiated

      // Enhanced session backup before PayPal redirect
      const backupSuccess = await SessionManager.backupSession(userId, planId);
      if (!backupSuccess) {
        console.warn('Session backup failed, but continuing with PayPal flow');
      }

      const { data, error } = await supabase.functions.invoke("process-paypal-payment", {
        body: {
          action: "create",
          planId,
          userId,
          amount: finalAmount,
          appliedDiscount
        }
      });

      if (error || !data?.success || !data?.approvalUrl) {
        throw new Error(error?.message || data?.error || "Failed to initiate PayPal checkout.");
      }

      // PayPal order created successfully

      // Store comprehensive payment context for callback recovery
      const paymentContext = {
        planId,
        userId,
        amount: finalAmount,
        orderId: data.orderId,
        timestamp: Date.now(),
        approvalUrl: data.approvalUrl,
        appliedDiscount,
        sessionBackedUp: backupSuccess
      };

      localStorage.setItem("pending_payment", JSON.stringify(paymentContext));
      // Payment context stored for callback recovery

      // Small delay to ensure localStorage is written
      await new Promise(resolve => setTimeout(resolve, 200));

      // Redirect to PayPal
      // Redirecting to PayPal approval URL
      window.location.href = data.approvalUrl;
      
    } catch (err: any) {
      console.error('PayPal checkout initiation failed:', err);
      setIsProcessing(false);
      onError(err);
      toast({
        title: "Error",
        description: err.message || "Payment initiation failed.",
        variant: "destructive"
      });
    }
  };

  const handlePayment = () => {
    if (is100PercentDiscount) {
      handleDirectActivation();
    } else {
      handlePayPalRedirect();
    }
  };

  if (isProcessing) {
    return (
      <div className="flex items-center justify-center py-8 bg-blue-50 border border-blue-200 rounded-lg">
        <Loader2 className="h-6 w-6 animate-spin mr-2 text-blue-600" />
        <span className="text-blue-700 font-medium">
          {is100PercentDiscount ? 'Activating subscription...' : 'Preparing PayPal checkout...'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full">
      <button
        className={`font-semibold px-6 py-3 rounded shadow flex items-center gap-2 w-full justify-center transition ${
          is100PercentDiscount 
            ? 'bg-green-500 hover:bg-green-600 text-white' 
            : 'bg-yellow-400 hover:bg-yellow-500 text-black'
        }`}
        onClick={handlePayment}
        disabled={isProcessing}
        type="button"
      >
        {is100PercentDiscount ? (
          <>
            <CheckCircle className="h-5 w-5 mr-2" />
            Activate Subscription (Free!)
            <ArrowRight className="w-4 h-4 ml-2" />
          </>
        ) : (
          <>
            <img src="https://www.paypalobjects.com/webstatic/icon/pp258.png" alt="PayPal" className="h-5 w-5 mr-2" />
            Pay ${finalAmount.toFixed(2)} with PayPal
            <ArrowRight className="w-4 h-4 ml-2" />
          </>
        )}
      </button>
      <p className="text-xs text-gray-500 text-center mt-2">
        {is100PercentDiscount 
          ? '🎉 Your discount covers the full amount - activate immediately!'
          : '🔒 You will be redirected to PayPal to complete your payment securely'
        }
      </p>
    </div>
  );
}
