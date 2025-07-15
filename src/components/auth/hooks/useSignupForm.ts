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
    },
  });

  const handleSubmit = async (values: SignupFormValues) => {
    setIsLoading(true);

    try {
      let redirectUrl = `${window.location.origin}/prompts`;
      
      if (selectedPlan) {
        redirectUrl = `${window.location.origin}/checkout?plan_id=${selectedPlan}`;
      } else if (fromCheckout) {
        redirectUrl = `${window.location.origin}/checkout`;
      }

      // Generate magic link using our edge function for better Apple deliverability
      const { data, error } = await supabase.functions.invoke('send-signup-confirmation', {
        body: {
          email: values.email,
          firstName: values.firstName,
          lastName: values.lastName,
          userId: crypto.randomUUID(), // Generate temporary ID
          redirectUrl: redirectUrl
        }
      });

      if (error) {
        console.error("Magic link generation error:", error);
        toast({
          variant: "destructive",
          title: "Error sending magic link",
          description: error.message || "Failed to send magic link. Please try again.",
        });
        return;
      }

      if (!data?.success) {
        console.error("Magic link sending failed:", data?.error);
        toast({
          variant: "destructive",
          title: "Error sending magic link", 
          description: data?.error || "Failed to send magic link. Please try again.",
        });
        return;
      }

      // Show success message and redirect to magic link sent page
      toast({
        title: "Magic link sent! ✨",
        description: "Check your email for a secure login link.",
      });

      // Send welcome email in the background for new users
      setTimeout(async () => {
        try {
          await sendWelcomeEmail(values.firstName, values.email);
        } catch (error) {
          console.log('Welcome email failed (non-critical):', error);
        }
      }, 1000);

      // Redirect to a magic link sent page
      const magicLinkParams = new URLSearchParams({
        email: values.email,
        firstName: values.firstName,
      });
      
      if (selectedPlan) {
        magicLinkParams.append('plan', selectedPlan);
      }
      if (fromCheckout) {
        magicLinkParams.append('fromCheckout', 'true');
      }
      
      navigate(`/magic-link-sent?${magicLinkParams.toString()}`);
    } catch (error) {
      console.error("Magic link error:", error);
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