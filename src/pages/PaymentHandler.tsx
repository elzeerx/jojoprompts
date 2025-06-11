
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PaymentHandler() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handlePaymentResult = async () => {
      try {
        // Extract tap_id from URL parameters
        const tapId = searchParams.get('tap_id');
        
        console.log('PaymentHandler: Processing payment with tap_id:', tapId);

        if (!tapId) {
          console.error('PaymentHandler: No tap_id found in URL');
          setError('No payment ID found in URL');
          setVerifying(false);
          return;
        }

        console.log('PaymentHandler: Confirming payment status with tap_id:', tapId);

        // Call tap-confirm function to verify payment status
        const { data: confirmData, error: confirmError } = await supabase.functions.invoke('tap-confirm', {
          body: { charge_id: tapId }
        });

        if (confirmError) {
          console.error('PaymentHandler: Payment confirmation failed:', confirmError);
          setError('Payment verification failed');
          setVerifying(false);
          return;
        }

        console.log('PaymentHandler: Payment confirmation result:', confirmData);

        const status = confirmData?.status;

        // Route based on payment status
        if (status === 'CAPTURED') {
          console.log('PaymentHandler: Payment successful, redirecting to success page');
          navigate(`/payment/success?tap_id=${tapId}`);
        } else if (status === 'FAILED') {
          console.log('PaymentHandler: Payment failed, redirecting to failure page');
          navigate(`/payment/failed?tap_id=${tapId}&reason=Payment was declined`);
        } else {
          // Still pending or unknown status
          console.log('PaymentHandler: Payment status pending or unknown:', status);
          setError(`Payment status: ${status}. Please wait or contact support if this persists.`);
          setVerifying(false);
        }

      } catch (error: any) {
        console.error('PaymentHandler: Verification error:', error);
        setError('Payment verification failed. Please contact support.');
        setVerifying(false);
      }
    };

    handlePaymentResult();
  }, [navigate, searchParams]);

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Verifying Payment
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600">
              Please wait while we confirm your payment...
            </p>
            <p className="text-sm text-gray-500 mt-2">
              This may take a few moments.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md mx-4 border-red-200">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Payment Verification Issue
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-700">{error}</p>
            <div className="space-y-2">
              <Button 
                onClick={() => window.location.reload()} 
                className="w-full"
                variant="outline"
              >
                Try Again
              </Button>
              <Button 
                onClick={() => navigate('/pricing')} 
                className="w-full"
              >
                Back to Pricing
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
