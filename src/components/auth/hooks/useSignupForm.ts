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
    },
  });

  const handleSubmit = async (values: SignupFormValues) => {
    setIsLoading(true);

    try {
      let redirectUrl = `${window.location.origin}/prompts?from_signup=true`;
      
      if (selectedPlan) {
        redirectUrl = `${window.location.origin}/checkout?plan_id=${selectedPlan}&from_signup=true`;
      } else if (fromCheckout) {
        redirectUrl = `${window.location.origin}/checkout?from_signup=true`;
      }

      // Completely disable Supabase email confirmation to prevent default templates
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          // Don't set emailRedirectTo to disable automatic email confirmation
          data: {
            first_name: values.firstName,
            last_name: values.lastName,
            email_confirm: false, // Prevent automatic email confirmation
          },
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast({
            variant: "destructive",
            title: "Account already exists",
            description: "This email is already registered. Please sign in instead.",
          });
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: error.message,
          });
        }
        return;
      }

      if (data.user) {
        // Always send our custom confirmation email (bypass Supabase entirely)
        console.log('Sending custom confirmation email for user:', data.user.id);
        
        try {
          const { data: emailData, error: emailError } = await supabase.functions.invoke('send-signup-confirmation', {
            body: {
              email: values.email,
              firstName: values.firstName,
              lastName: values.lastName,
              userId: data.user.id,
              redirectUrl: redirectUrl
            }
          });

          if (emailError) {
            console.error('Failed to send confirmation email:', emailError);
            toast({
              variant: "destructive",
              title: "Email delivery issue",
              description: "Your account was created but we couldn't send the confirmation email. Please try the resend button.",
            });
          } else {
            console.log('Custom confirmation email sent successfully:', emailData);
          }
        } catch (emailError) {
          console.error('Error sending confirmation email:', emailError);
          toast({
            variant: "destructive",
            title: "Email delivery issue", 
            description: "Your account was created but we couldn't send the confirmation email. Please try the resend button.",
          });
        }

        // Send welcome email in the background (don't block the flow)
        setTimeout(async () => {
          await sendWelcomeEmail(values.firstName, values.email);
        }, 1000);

        // Always redirect to confirmation page for manual confirmation
        const confirmationParams = new URLSearchParams({
          email: values.email,
          firstName: values.firstName,
        });
        
        if (selectedPlan) {
          confirmationParams.append('plan', selectedPlan);
        }
        if (fromCheckout) {
          confirmationParams.append('fromCheckout', 'true');
        }
        
        navigate(`/email-confirmation?${confirmationParams.toString()}`);
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