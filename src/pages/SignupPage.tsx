
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { useSignupForm } from "@/components/auth/hooks/useSignupForm";
import { useGoogleAuth } from "@/components/auth/hooks/useGoogleAuth";
import { SignupHeader } from "@/components/auth/SignupHeader";
import { GoogleSignupButton } from "@/components/auth/GoogleSignupButton";
import { SignupForm } from "@/components/auth/SignupForm";

export default function SignupPage() {
  const navigate = useNavigate();
  
  const {
    form,
    isLoading,
    selectedPlan,
    fromCheckout,
    handleSubmit,
    handleFormError,
  } = useSignupForm();

  const {
    isGoogleLoading,
    handleGoogleSignUp,
  } = useGoogleAuth();

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-9rem)] mobile-container-padding mobile-section-padding">
      <Card className="mx-auto max-w-sm w-full border-2 border-warm-gold/20 rounded-2xl shadow-xl bg-white/95 backdrop-blur-sm">
        <SignupHeader fromCheckout={fromCheckout} selectedPlan={selectedPlan} />
        
        <CardContent className="space-y-4 px-4 sm:px-6">
          <GoogleSignupButton
            isGoogleLoading={isGoogleLoading}
            isLoading={isLoading}
            onGoogleSignUp={handleGoogleSignUp}
          />

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

          <SignupForm
            form={form}
            isLoading={isLoading}
            isGoogleLoading={isGoogleLoading}
            onSubmit={handleSubmit}
            onFormError={handleFormError}
          />
        </CardContent>
        
        <CardFooter className="flex flex-col space-y-4 px-4 sm:px-6 pb-6">
          <p className="text-xs sm:text-sm text-muted-foreground text-center">
            Already have an account?{" "}
            <Button 
              variant="link" 
              className="p-0 text-xs sm:text-sm text-warm-gold hover:text-warm-gold/80" 
              onClick={() => {
                const params = selectedPlan ? `?plan=${selectedPlan}` : "";
                navigate(`/login${params}`);
              }}
            >
              Sign in
            </Button>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
