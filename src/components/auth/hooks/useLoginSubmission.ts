
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { SecurityEnforcer } from "@/utils/enhancedSecurity";
import type { LoginFormValues } from "../hooks/useLoginForm";

export function useLoginSubmission(onSuccess?: () => void) {
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);

  // Returns a Promise<boolean>: true if login succeeded.
  async function onSubmit(values: LoginFormValues): Promise<boolean> {
    setRateLimitError(null);

    const rateLimitCheck = SecurityEnforcer.checkAuthRateLimit('login', values.email);
    if (!rateLimitCheck.allowed) {
      const message = `Too many login attempts. Please try again in ${rateLimitCheck.retryAfter} seconds.`;
      setRateLimitError(message);
      SecurityEnforcer.logAuthAttempt('login', values.email, false, 'Rate limited');
      return false;
    }

    const validation = await SecurityEnforcer.validateUserInput(values);

    if (!validation.isValid) {
      toast({
        variant: "destructive",
        title: "Invalid Input",
        description: validation.errors.join(', ')
      });
      return false;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        SecurityEnforcer.logAuthAttempt('login', values.email, false, error.message);
        SecurityEnforcer.detectSuspiciousActivity('login_failure', {
          email: values.email.split('@')[1]
        });
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: error.message,
        });
        return false;
      } else {
        SecurityEnforcer.logAuthAttempt('login', values.email, true);
        toast({
          title: "Welcome back!",
          description: "You have been logged in successfully.",
        });
        SecurityEnforcer.secureClearSensitiveData(values);
        onSuccess?.();
        return true;
      }
    } catch (error: any) {
      SecurityEnforcer.logAuthAttempt('login', values.email, false, error.message);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  return { isLoading, rateLimitError, onSubmit, setRateLimitError };
}
