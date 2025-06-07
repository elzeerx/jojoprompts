
import { useState } from "react";
import { CheckoutLoginForm } from "./CheckoutLoginForm";
import { CheckoutSignupFormContent } from "./CheckoutSignupFormContent";

interface CheckoutSignupFormProps {
  onSuccess: () => void;
  planName: string;
  planPrice: number;
}

export function CheckoutSignupForm({ onSuccess, planName, planPrice }: CheckoutSignupFormProps) {
  const [isLogin, setIsLogin] = useState(false);

  const handleSwitchToSignup = () => {
    setIsLogin(false);
  };

  const handleSwitchToLogin = () => {
    setIsLogin(true);
  };

  if (isLogin) {
    return (
      <CheckoutLoginForm
        onSuccess={onSuccess}
        onSwitchToSignup={handleSwitchToSignup}
        planName={planName}
        planPrice={planPrice}
      />
    );
  }

  return (
    <CheckoutSignupFormContent
      onSuccess={onSuccess}
      onSwitchToLogin={handleSwitchToLogin}
      planName={planName}
      planPrice={planPrice}
    />
  );
}
