
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWelcomeEmail } from "@/hooks/useWelcomeEmail";
import { SignupFormValues, signupSchema } from "../validation";

export function useSignupForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { sendWelcomeEmail } = useWelcomeEmail();
  
  const selectedPlan = searchParams.get('plan');
  const fromCheckout = searchParams.get('fromCheckout') === 'true';

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    mode: "onSubmit",
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
    },
  });

  // Add debugging for form errors
  useEffect(() => {
    const subscription = form.watch(() => {
      const errors = form.formState.errors;
      if (Object.keys(errors).length > 0) {
        console.log("Form validation errors:", errors);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const handleSubmit = async (values: SignupFormValues) => {
    console.log("Form submitted with values:", { ...values, password: "[REDACTED]" });
    setIsLoading(true);

    try {
      // Build redirect URL with plan context for email confirmation
      let redirectUrl = `${window.location.origin}/prompts`;
      
      // If there's a plan selected, include it in the redirect URL
      if (selectedPlan) {
        redirectUrl = `${window.location.origin}/checkout?plan_id=${selectedPlan}&from_signup=true`;
      } else if (fromCheckout) {
        redirectUrl = `${window.location.origin}/checkout?from_signup=true`;
      }

      console.log("Attempting signup with redirect URL:", redirectUrl);

      // Step 1: Sign up the user with redirect URL for email confirmation
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            first_name: values.firstName,
            last_name: values.lastName,
          },
          emailRedirectTo: redirectUrl,
        },
      });

      if (signupError) {
        console.error("Signup error:", signupError);
        toast({
          variant: "destructive",
          title: "Error",
          description: signupError.message,
        });
        setIsLoading(false);
        return;
      }

      console.log("Signup successful:", signupData);

      // Step 2: Send welcome email after successful signup
      if (signupData.user) {
        const fullName = `${values.firstName} ${values.lastName}`.trim();
        console.log("Sending welcome email to:", values.email);
        
        try {
          const emailResult = await sendWelcomeEmail(fullName, values.email);
          if (emailResult.success) {
            console.log("Welcome email sent successfully");
          } else {
            console.warn("Welcome email failed to send:", emailResult.error);
          }
        } catch (emailError) {
          console.error("Welcome email error:", emailError);
          // Don't fail the signup if email sending fails
        }
      }

      // Show success message with email confirmation instructions
      toast({
        title: "Account created! 📧",
        description: selectedPlan 
          ? "Please check your email and click the confirmation link to complete your subscription."
          : "Please check your email and click the confirmation link to activate your account.",
      });

      // Don't auto-login, let the user confirm their email first
      // This ensures they go through the email confirmation flow
      
    } catch (error) {
      console.error("Signup error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
    }

    setIsLoading(false);
  };

  const handleFormError = (errors: any) => {
    console.error("Form validation failed:", errors);
    toast({
      variant: "destructive",
      title: "Validation Error",
      description: "Please check the form fields and try again.",
    });
  };

  return {
    form,
    isLoading,
    selectedPlan,
    fromCheckout,
    handleSubmit,
    handleFormError,
  };
}
