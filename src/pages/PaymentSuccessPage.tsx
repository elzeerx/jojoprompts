
import { useState } from "react";
import { usePaymentSuccessParams } from "@/hooks/payment/usePaymentSuccessParams";
import { usePaymentSuccessVerification } from "@/hooks/payment/usePaymentSuccessVerification";
import { PaymentSuccessLoader } from "@/components/payment/PaymentSuccessLoader";
import { PaymentSuccessError } from "@/components/payment/PaymentSuccessError";
import { PaymentSuccessCard } from "@/components/payment/PaymentSuccessCard";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, LogIn } from "lucide-react";
import { Link } from "react-router-dom";

export default function PaymentSuccessPage() {
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  const params = usePaymentSuccessParams();
  const authRequired = searchParams.get('auth_required') === 'true';

  usePaymentSuccessVerification({
    params,
    setVerifying,
    setVerified,
    setError,
  });

  // Special case: Payment successful but authentication required
  if (authRequired && !verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-soft-bg py-16">
        <div className="container mx-auto max-w-md px-4">
          <Card className="border-2 border-green-200 shadow-xl bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden">
            <CardHeader className="text-center pb-4 bg-gradient-to-r from-green-50 to-green-100/50">
              <div className="flex justify-center mb-4">
                <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
              </div>
              <CardTitle className="text-2xl font-bold text-green-800">Payment Successful!</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-6 p-6">
              <div className="space-y-3">
                <p className="text-lg text-green-700 font-medium">
                  Your payment has been processed successfully!
                </p>
                <p className="text-muted-foreground">
                  To access your premium features, please log in to your account.
                </p>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <LogIn className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <div className="text-left">
                    <p className="font-medium text-green-800 text-sm mb-1">Next Step:</p>
                    <p className="text-sm text-green-700">
                      Click the button below to log in and start using your premium subscription.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Button asChild className="w-full bg-green-600 hover:bg-green-700">
                  <Link to="/login">
                    <LogIn className="h-4 w-4 mr-2" />
                    Log In to Access Premium
                  </Link>
                </Button>
                
                <Button variant="outline" asChild className="w-full">
                  <Link to="/contact">Contact Support</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (verifying) {
    return <PaymentSuccessLoader />;
  }

  if (error) {
    // Enhanced: If error is about authentication/session, prompt user to log in
    if (error.toLowerCase().includes("login") || error.toLowerCase().includes("authentication")) {
      return (
        <div>
          <PaymentSuccessError error={error} />
          <div className="py-6 text-center">
            <p className="mb-2 text-sm text-muted-foreground">
              If you already paid but were logged out, please log back in to access premium content or try <a href="/prompts" className="underline">here</a>.
            </p>
            <a href="/login" className="inline-block mt-2 px-5 py-2 rounded bg-blue-500 text-white font-medium">
              Log In Again
            </a>
          </div>
        </div>
      );
    }
    return <PaymentSuccessError error={error} />;
  }

  if (!verified) {
    return <PaymentSuccessLoader />;
  }

  return <PaymentSuccessCard />;
}
