
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useTapConfig } from "./hooks/useTapConfig";
import { usePaymentConversion } from "./hooks/usePaymentConversion";

declare global {
  interface Window {
    Tapjsli?: any;
  }
}

interface SecureTapPaymentButtonProps {
  amount: number;
  planName: string;
  onSuccess: (paymentId: string) => void;
  onError?: (error: any) => void;
}

export function SecureTapPaymentButton({
  amount,
  planName,
  onSuccess,
  onError
}: SecureTapPaymentButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { user } = useAuth();
  const { getTapConfig } = useTapConfig();
  const { getKWDAmount } = usePaymentConversion();

  const loadTapScript = async () => {
    if (window.Tapjsli) return true;

    return new Promise<boolean>((resolve) => {
      const script = document.createElement("script");
      script.src = "https://tap.company/js/pay.js";
      script.onload = () => resolve(!!window.Tapjsli);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  };

  const handlePayment = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to continue",
        variant: "destructive"
      });
      return;
    }

    setIsOpen(true);
    setLoading(true);
    setError(null);

    try {
      // Get configuration
      const config = await getTapConfig(amount, planName);
      
      // Load script
      const scriptLoaded = await loadTapScript();
      if (!scriptLoaded) {
        throw new Error("Failed to load Tap payment interface");
      }

      // Initialize payment
      const kwdAmount = getKWDAmount(amount);
      
      window.Tapjsli({
        publicKey: config.publishableKey,
        merchant: config.publishableKey,
        amount: kwdAmount,
        currency: "KWD",
        customer: {
          id: user.id,
          email: user.email
        },
        onSuccess: (response: any) => {
          console.log("Tap payment success:", response);
          setIsOpen(false);
          onSuccess(response.transaction?.id || response.id);
        },
        onError: (error: any) => {
          console.error("Tap payment error:", error);
          setError(error.message || "Payment failed");
          if (onError) onError(error);
        },
        onClose: () => {
          setLoading(false);
        }
      });

      setLoading(false);
    } catch (err: any) {
      console.error("Tap initialization error:", err);
      setError(err.message);
      setLoading(false);
    }
  };

  const displayAmount = getKWDAmount(amount).toFixed(2);

  if (error) {
    return (
      <div className="w-full p-4 bg-red-50 border border-red-200 rounded">
        <p className="text-red-800 text-sm mb-2">{error}</p>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={() => {
            setError(null);
            handlePayment();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button 
        className="w-full" 
        onClick={handlePayment}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading...
          </>
        ) : (
          `Pay with Tap Payment (${displayAmount} KWD)`
        )}
      </Button>
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">
              {planName} Plan - {displayAmount} KWD
            </h3>
            {loading && (
              <div className="py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p>Initializing secure payment...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
