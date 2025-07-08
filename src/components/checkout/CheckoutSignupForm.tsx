
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus } from "lucide-react";
import { GoogleAuthButton } from "./components/GoogleAuthButton";
import { TrustSignals } from "./components/TrustSignals";
import { SignupForm } from "./components/SignupForm";
import { LoginForm } from "./components/LoginForm";
import { AuthModeToggle } from "./components/AuthModeToggle";

interface CheckoutSignupFormProps {
  onSuccess: () => void;
  planName: string;
  planPrice: number;
}

export function CheckoutSignupForm({ onSuccess, planName, planPrice }: CheckoutSignupFormProps) {
  const [isLogin, setIsLogin] = useState(false);

  const handleToggleMode = () => {
    setIsLogin(!isLogin);
  };

  const handleSwitchToLogin = () => {
    setIsLogin(true);
  };

  return (
    <Card className="w-full">
      <CardHeader className="text-center pb-4">
        <div className="flex justify-center mb-3">
          <div className="rounded-full bg-warm-gold/10 p-3">
            <UserPlus className="h-6 w-6 text-warm-gold" />
          </div>
        </div>
        <CardTitle className="text-xl">
          {isLogin ? "Sign In to Continue" : "Create Your Account"}
        </CardTitle>
        <div className="bg-green-50 border border-green-100 rounded-md p-3 mt-3">
          <p className="text-sm text-green-800 text-center">
            You're purchasing <strong>{planName}</strong> for <strong>${planPrice}</strong>
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <TrustSignals />

        <GoogleAuthButton />

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with email
            </span>
          </div>
        </div>

        {!isLogin ? (
          <SignupForm 
            onSuccess={onSuccess}
            onSwitchToLogin={handleSwitchToLogin}
          />
        ) : (
          <LoginForm onSuccess={onSuccess} />
        )}

        <AuthModeToggle 
          isLogin={isLogin}
          onToggle={handleToggleMode}
        />
      </CardContent>
    </Card>
  );
}
