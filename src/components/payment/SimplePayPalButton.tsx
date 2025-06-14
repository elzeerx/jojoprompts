
import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, ArrowRight } from 'lucide-react';

interface SimplePayPalButtonProps {
  amount: number;
  planId: string;
  userId: string;
  onSuccess: (data: any) => void;
  onError: (error: any) => void;
}

export function SimplePayPalButton({ 
  amount, 
  planId, 
  userId, 
  onSuccess, 
  onError 
}: SimplePayPalButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayPalRedirect = async () => {
    setIsProcessing(true);
    try {
      // Create the PayPal order via Supabase Edge Function
      const { data, error } = await supabase.functions.invoke("process-paypal-payment", {
        body: {
          action: "create",
          planId,
          userId,
          amount
        }
      });

      if (error || !data?.success || !data?.approvalUrl) {
        throw new Error(error?.message || data?.error || "Failed to initiate PayPal checkout.");
      }

      // Store payment context in localStorage to match callback handling
      localStorage.setItem(
        "pending_payment",
        JSON.stringify({ planId, userId, amount, timestamp: Date.now() })
      );

      window.location.href = data.approvalUrl;
    } catch (err: any) {
      setIsProcessing(false);
      onError(err);
      toast({
        title: "Error",
        description: err.message || "Payment initiation failed.",
        variant: "destructive"
      });
    }
  };

  if (isProcessing) {
    return (
      <div className="flex items-center justify-center py-8 bg-blue-50 border border-blue-200 rounded-lg">
        <Loader2 className="h-6 w-6 animate-spin mr-2 text-blue-600" />
        <span className="text-blue-700 font-medium">Redirecting to PayPal...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full">
      <button
        className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold px-6 py-3 rounded shadow flex items-center gap-2 w-full justify-center transition"
        onClick={handlePayPalRedirect}
        disabled={isProcessing}
        type="button"
      >
        <img src="https://www.paypalobjects.com/webstatic/icon/pp258.png" alt="PayPal" className="h-5 w-5 mr-2" />
        Pay with PayPal
        <ArrowRight className="w-4 h-4 ml-2" />
      </button>
      <p className="text-xs text-gray-500 text-center mt-2">
        🔒 You will be redirected to PayPal to complete your payment securely
      </p>
    </div>
  );
}
