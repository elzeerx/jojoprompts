import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { signupSchema, type SignupFormValues } from "../validation";
import { useWelcomeEmail } from "@/hooks/useWelcomeEmail";
import { createLogger } from '@/utils/logging';
import { handleError, ErrorTypes } from '@/utils/errorHandler';
import { retrySignupOperation } from '@/utils/signupErrorHandler';

const logger = createLogger('SIGNUP_FORM');

export function useSignupForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { sendWelcomeEmail } = useWelcomeEmail();

  const selectedPlan = searchParams.get('plan');
  const fromCheckout = searchParams.get('fromCheckout') === 'true';

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const handleSubmit = async (values: SignupFormValues) => {
    setIsLoading(true);

    try {
      // PHASE 2: Validation with retry logic for transient failures
      logger.info('Validating signup data with retry support');
      
      const validationResult = await retrySignupOperation(
        async () => {
          const { data: validationData, error: validationError } = await supabase.functions.invoke('validate-signup', {
            body: {
              email: values.email,
              username: values.username,
              firstName: values.firstName,
              lastName: values.lastName,
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
        { email: values.email, username: values.username, operation: "validation" },
        2 // Max 2 retries for validation
      );

      if (!validationResult.success) {
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
                first_name: values.firstName,
                last_name: values.lastName,
                username: values.username,
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
                firstName: values.firstName,
                lastName: values.lastName
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

      // Navigate directly to checkout if from checkout flow
      if (selectedPlan) {
        navigate(`/checkout?plan_id=${selectedPlan}&from_signup=true`);
      } else if (fromCheckout) {
        navigate('/checkout?from_signup=true');
      } else {
        navigate('/prompts');
      }
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
    selectedPlan,
    fromCheckout,
    handleSubmit,
    handleFormError,
    onSubmit: handleSubmit,
    onFormError: handleFormError,
  };
}