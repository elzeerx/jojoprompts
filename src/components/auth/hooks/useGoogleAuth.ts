
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckoutContextManager } from "@/utils/checkoutContext";

export function useGoogleAuth() {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const selectedPlan = searchParams.get('plan');
  const fromCheckout = searchParams.get('fromCheckout') === 'true';

  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true);

    try {
      // Save checkout context before OAuth redirect
      if (selectedPlan || fromCheckout) {
        CheckoutContextManager.saveContext({
          planId: selectedPlan || undefined,
          fromCheckout: fromCheckout
        });
      }

      // Build redirect URL for Google OAuth
      const redirectUrl = CheckoutContextManager.buildRedirectUrl(
        window.location.origin,
        selectedPlan || undefined,
        true
      );

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
      }
    } catch (error) {
      console.error("Google sign-up error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
    }

    setIsGoogleLoading(false);
  };

  return {
    isGoogleLoading,
    handleGoogleSignUp,
  };
}
