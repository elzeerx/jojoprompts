import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { signupSchema, type SignupFormValues } from "../validation";
import { useWelcomeEmail } from "@/hooks/useWelcomeEmail";

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
      console.log('[Signup] Validating signup data...');
      
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
        console.error('[Signup] Validation edge function error:', validationError);
        toast({
          variant: "destructive",
          title: "Validation failed",
          description: validationError.message || "Unable to validate signup data. Please try again.",
        });
        return;
      }

      if (!validationData?.valid) {
        console.error('[Signup] Validation failed:', validationData?.errors);
        const errorMessage = validationData?.errors?.[0] || "Signup validation failed";
        toast({
          variant: "destructive",
          title: "Signup validation failed",
          description: errorMessage,
        });
        return;
      }

      console.log('[Signup] Validation passed, proceeding with signup...');

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
        console.error("[Signup] Supabase signup error:", error);
        toast({
          variant: "destructive",
          title: "Signup failed",
          description: error.message || "Failed to create account. Please try again.",
        });
        return;
      }

      if (!data.user) {
        toast({
          variant: "destructive",
          title: "Signup failed",
          description: "Failed to create account. Please try again.",
        });
        return;
      }

      // Check if email confirmation is required
      if (!data.session && data.user) {
        toast({
          title: "Verify your email",
          description: "We've sent you a verification email. Please check your inbox and click the link to activate your account.",
        });
        navigate('/auth/verify-email');
        return;
      }

      // Success! User is now logged in
      toast({
        title: "Account created! 🎉",
        description: "Welcome! You can now complete your purchase.",
      });

      // Send welcome email in the background (post-signup)
      setTimeout(async () => {
        try {
          await sendWelcomeEmail(values.firstName, values.email);
        } catch (error) {
          console.log('Welcome email failed (non-critical):', error);
        }
      }, 1000);

      // Navigate directly to checkout if from checkout flow
      if (selectedPlan) {
        navigate(`/checkout?plan_id=${selectedPlan}&from_signup=true`);
      } else if (fromCheckout) {
        navigate('/checkout?from_signup=true');
      } else {
        navigate('/prompts');
      }
    } catch (error) {
      console.error("Signup error:", error);
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
    console.log("Form validation errors:", errors);
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