
import { useState } from "react";
import { usePaymentSuccessParams } from "@/hooks/payment/usePaymentSuccessParams";
import { usePaymentSuccessVerification } from "@/hooks/payment/usePaymentSuccessVerification";
import { PaymentSuccessLoader } from "@/components/payment/PaymentSuccessLoader";
import { PaymentSuccessError } from "@/components/payment/PaymentSuccessError";
import { PaymentSuccessCard } from "@/components/payment/PaymentSuccessCard";

export default function PaymentSuccessPage() {
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = usePaymentSuccessParams();

  usePaymentSuccessVerification({
    params,
    setVerifying,
    setVerified,
    setError,
  });

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
