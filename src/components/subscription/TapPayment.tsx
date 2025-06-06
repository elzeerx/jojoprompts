
import React from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTapPayment } from "@/hooks/useTapPayment";
import { TapPaymentError } from "./TapPaymentError";

interface TapPaymentProps {
  amount: number;
  planName: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
  onStart?: () => void;
  onUnavailable?: (reason: string) => void;
}

export function TapPayment(props: TapPaymentProps) {
  const { user } = useAuth();
  const {
    loading,
    error,
    retryCount,
    maxRetries,
    kwdAmount,
    handleTapPayment,
    handleRetry
  } = useTapPayment(props);

  return (
    <div className="space-y-3">
      {error && (
        <TapPaymentError
          error={error}
          retryCount={retryCount}
          maxRetries={maxRetries}
          onRetry={handleRetry}
        />
      )}
      
      <Button 
        className="w-full" 
        onClick={handleTapPayment}
        disabled={loading || !user}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing Payment...
          </>
        ) : (
          `Pay with Tap (${kwdAmount} KWD)`
        )}
      </Button>
      
      {!user && (
        <p className="text-xs text-red-600 text-center">
          Please log in to use Tap payment
        </p>
      )}
    </div>
  );
}
