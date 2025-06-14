
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { CheckoutSignupFormValues, checkoutSignupSchema } from "@/components/auth/validation";
import { supabase } from "@/integrations/supabase/client";
import { logInfo, logError, logDebug } from "@/utils/secureLogging";

interface SignupFormProps {
  onSuccess: () => void;
  onSwitchToLogin: () => void;
  disabled?: boolean;
}

export function SignupForm({ onSuccess, onSwitchToLogin, disabled }: SignupFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<CheckoutSignupFormValues>({
    resolver: zodResolver(checkoutSignupSchema),
    mode: "onSubmit",
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
    },
  });

  const handleSignup = async (values: CheckoutSignupFormValues) => {
    logInfo("Starting signup process", "auth");
    logDebug("Signup form submission", "auth", { 
      email: values.email, 
      hasPassword: !!values.password,
      hasConfirmPassword: !!values.confirmPassword,
      firstName: values.firstName,
      lastName: values.lastName 
    });
    setIsLoading(true);

    try {
      // Step 1: Sign up the user
      logDebug("Attempting to create user account", "auth");
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            first_name: values.firstName,
            last_name: values.lastName,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (signupError) {
        logError("Signup error", "auth", { error: signupError.message });
        toast({
          variant: "destructive",
          title: "Error",
          description: signupError.message,
        });
        setIsLoading(false);
        return;
      }

      logInfo("User account created successfully", "auth", undefined, signupData.user?.id);

      // Step 2: Automatically sign in the user
      logDebug("Attempting to sign in the new user", "auth", undefined, signupData.user?.id);
      const { error: signinError } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (signinError) {
        logError("Auto sign-in error", "auth", { error: signinError.message }, signupData.user?.id);
        toast({
          variant: "destructive",
          title: "Account created but couldn't sign in automatically",
          description: "Please proceed to login with your new credentials.",
        });
        onSwitchToLogin();
      } else {
        logInfo("User signed in successfully", "auth", undefined, signupData.user?.id);
        toast({
          title: "Welcome!",
          description: "Your account has been created. Please complete your purchase.",
        });
        onSuccess();
      }
    } catch (error: any) {
      logError("Signup error", "auth", { error: error.message });
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
    }

    setIsLoading(false);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSignup)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input placeholder="John" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input placeholder="Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="name@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters long
              </p>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm Password</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isLoading || disabled}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create Account & Continue"
          )}
        </Button>
      </form>
    </Form>
  );
}
