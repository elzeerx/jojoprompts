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
      // Call validation edge function first
      logger.info('Validating signup data');
      
      const { data: validationData, error: validationError } = await supabase.functions.invoke('validate-signup', {
        body: {
          email: values.email,
          username: values.username,
          firstName: values.firstName,
          lastName: values.lastName,
          ipAddress: window.location.hostname
        }
      });

      if (validationError) {
        logger.error('Validation edge function error', validationError);
        toast({
          variant: "destructive",
          title: "Validation failed",
          description: validationError.message || "Unable to validate signup data. Please try again.",
        });
        return;
      }

      if (!validationData?.valid) {
        logger.warn('Validation failed', { errors: validationData?.errors });
        const errorMessage = validationData?.errors?.[0] || "Signup validation failed";
        toast({
          variant: "destructive",
          title: "Signup validation failed",
          description: errorMessage,
        });
        return;
      }

      logger.info('Validation passed, proceeding with signup');

      // Direct email/password signup with Supabase
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            first_name: values.firstName,
            last_name: values.lastName,
            username: values.username,
          },
          // Enable email confirmation for security
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        logger.error('Supabase signup error', error);
        throw ErrorTypes.AUTH_INVALID({ 
          component: 'useSignupForm', 
          action: 'signup' 
        });
      }

      if (data?.user) {
        try {
          await supabase.functions.invoke('send-welcome-email', {
            body: { 
              email: data.user.email, 
              userId: data.user.id,
              firstName: values.firstName,
              lastName: values.lastName
            }
          });
        } catch (error) {
          logger.warn('Welcome email failed (non-critical)', error);
        }
      }

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
      logger.error('Signup error', appError);
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