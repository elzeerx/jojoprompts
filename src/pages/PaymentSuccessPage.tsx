
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

  // Set verifying to true initially for extra safety on fast navigation
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
    return <PaymentSuccessError error={error} />;
  }

  if (!verified) {
    // Fallback: show loader instead of error, for a better UX as in original
    return <PaymentSuccessLoader />;
  }

  return <PaymentSuccessCard />;
}

