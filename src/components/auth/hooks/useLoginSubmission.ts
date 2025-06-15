
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { SecurityEnforcer } from "@/utils/enhancedSecurity";

export function useLoginSubmission(onSuccess?: () => void) {
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);

  async function onSubmit(values: { email: string; password: string }, reset: () => void) {
    setRateLimitError(null);

    // Rate limiting
    const rateLimitCheck = SecurityEnforcer.checkAuthRateLimit('login', values.email);
    if (!rateLimitCheck.allowed) {
      const message = `Too many login attempts. Please try again in ${rateLimitCheck.retryAfter} seconds.`;
      setRateLimitError(message);
      SecurityEnforcer.logAuthAttempt('login', values.email, false, 'Rate limited');
      return;
    }

    // Validation
    const validation = SecurityEnforcer.validateUserInput(values);

    if (!validation.isValid) {
      toast({
        variant: "destructive",
        title: "Invalid Input",
        description: validation.errors.join(', ')
      });
      return;
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
      } else {
        SecurityEnforcer.logAuthAttempt('login', values.email, true);
        toast({
          title: "Welcome back!",
          description: "You have been logged in successfully.",
        });
        reset();
        SecurityEnforcer.secureClearSensitiveData(values);
        onSuccess?.();
      }
    } catch (error: any) {
      SecurityEnforcer.logAuthAttempt('login', values.email, false, error.message);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return { isLoading, rateLimitError, onSubmit, setRateLimitError };
}
