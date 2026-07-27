import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { signupSchema, type SignupFormValues, splitFullName, generateUsernameFromEmail } from "../validation";
import { useWelcomeEmail } from "@/hooks/useWelcomeEmail";
import { createLogger } from '@/utils/logging';
import { handleError } from '@/utils/errorHandler';
import { retrySignupOperation } from '@/utils/signupErrorHandler';
import { resolveSafeNext } from "@/lib/v2/safeNext";

const logger = createLogger('SIGNUP_FORM');

export function useSignupForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { sendWelcomeEmail } = useWelcomeEmail();

  // V2: plan / fromCheckout query flags are no longer honored for post-signup
  // routing. A confirmed user is asked to browse and acquire items directly.
  const safeNextPath = resolveSafeNext(searchParams.get("next"));

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
    },
  });

  const handleSubmit = async (values: SignupFormValues) => {
    setIsLoading(true);

    try {
      // Split full name into first and last name
      const { firstName, lastName } = splitFullName(values.fullName);
      
      // Auto-generate username from email
      const username = generateUsernameFromEmail(values.email);

      // PHASE 2: Validation with retry logic for transient failures
      logger.info('Validating signup data with retry support');
      
      const validationResult = await retrySignupOperation(
        async () => {
          const { data: validationData, error: validationError } = await supabase.functions.invoke('validate-signup', {
            body: {
              email: values.email,
              username: username,
              firstName: firstName,
              lastName: lastName || firstName, // Use firstName as lastName if not provided
              ipAddress: window.location.hostname
            }
          });

          if (validationError) throw validationError;
          if (!validationData?.valid) {
            const errors = validationData?.errors || ["Validation failed"];
            throw new Error(errors[0]);
          }

          return validationData;
        },
        { email: values.email, username: username, operation: "validation" },
        2 // Max 2 retries for validation
      );

      if (!validationResult.success) {
        setIsLoading(false);
        return;
      }

      logger.info('Validation passed, proceeding with signup');

      // PHASE 2: Signup with retry logic
      const signupResult = await retrySignupOperation(
        async () => {
          const { data, error } = await supabase.auth.signUp({
            email: values.email,
            password: values.password,
            options: {
              data: {
                first_name: firstName,
                last_name: lastName || firstName,
                username: username,
              },
              emailRedirectTo: `${window.location.origin}/auth/callback`
            }
          });

          if (error) throw error;
          if (!data.user) throw new Error("Account creation failed");

          return data;
        },
        { email: values.email, operation: "signup" },
        1 // Max 1 retry for signup
      );

      if (!signupResult.success) {
        setIsLoading(false);
        return;
      }

      const signupData = signupResult.data!;
      logger.info('User account created, sending welcome email', { userId: signupData.user!.id });

      // PHASE 2: Welcome email with error tolerance (don't fail signup if email fails)
      try {
        await retrySignupOperation(
          async () => {
            const { error } = await supabase.functions.invoke('send-welcome-email', {
              body: { 
                email: signupData.user!.email, 
                userId: signupData.user!.id,
                firstName: firstName,
                lastName: lastName || firstName
              }
            });
            if (error) throw error;
            return true;
          },
          { email: values.email, operation: "welcome-email" },
          1 // Only 1 retry for email
        );
      } catch (emailError: any) {
        logger.warn('Welcome email failed after retries (non-critical)', emailError);
      }

      logger.info('Signup completed successfully');
      toast({
        title: "Account Created! 🎉",
        description: "Please check your email to verify your account.",
      });

      // V2: default to the safe post-auth destination — no plan-based
      // checkout redirect and no "complete your subscription" prompt.
      navigate(safeNextPath);
    } catch (error) {
      const appError = handleError(error, { component: 'useSignupForm', action: 'signup' });
      logger.error('Unexpected signup error after all retries', appError);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormError = (errors: any) => {
    logger.debug('Form validation errors', { errors });
    const firstErrorField = Object.keys(errors)[0];
    const firstError = errors[firstErrorField];
    
    if (firstError?.message) {
      toast({
        variant: "destructive",
        title: "Invalid input",
        description: firstError.message,
      });
    }
  };

  return {
    form,
    isLoading,
    selectedPlan: null as string | null,
    fromCheckout: false,
    handleSubmit,
    handleFormError,
    onSubmit: handleSubmit,
    onFormError: handleFormError,
  };
}
