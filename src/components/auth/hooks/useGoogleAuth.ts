import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { createLogger } from '@/utils/logging';
import { handleError } from '@/utils/errorHandler';
import { resolveSafeNext } from "@/lib/v2/safeNext";

const logger = createLogger('GOOGLE_AUTH');

/**
 * V2 Google OAuth entry used by SignupPage.
 *
 * Post-auth destination is derived solely from `resolveSafeNext(next)` — the
 * legacy plan/fromCheckout query flags are NOT honored, and
 * CheckoutContextManager is intentionally not imported here. Confirmed users
 * land on their safe same-origin `next` or the /explore fallback.
 */
export function useGoogleAuth() {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const safeNextPath = resolveSafeNext(searchParams.get('next'));

  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true);

    try {
      const redirectUrl = `${window.location.origin}${safeNextPath}`;

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
      const appError = handleError(error, { component: 'useGoogleAuth', action: 'googleSignUp' });
      logger.error('Google sign-up error', appError);
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
