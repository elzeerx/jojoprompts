
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
      firstName: "",
      lastName: "",
    },
  });

  const handleSignup = async (values: CheckoutSignupFormValues) => {
    logInfo("Starting magic link signup process", "auth");
    logDebug("Magic link signup form submission", "auth", { 
      email: values.email,
      firstName: values.firstName,
      lastName: values.lastName 
    });
    setIsLoading(true);

    try {
      // Send magic link for immediate checkout access
      logDebug("Sending magic link for checkout", "auth");
      const { error } = await supabase.auth.signInWithOtp({
        email: values.email,
        options: {
          emailRedirectTo: `${window.location.origin}/checkout`,
          data: {
            first_name: values.firstName,
            last_name: values.lastName,
          },
        },
      });

      if (error) {
        logError("Magic link error", "auth", { error: error.message });
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
        setIsLoading(false);
        return;
      }

      logInfo("Magic link sent successfully", "auth");
      toast({
        title: "Magic link sent! ✨",
        description: "Check your email and click the link to continue with your purchase.",
      });
    } catch (error: any) {
      logError("Magic link signup error", "auth", { error: error.message });
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
        <Button type="submit" className="w-full" disabled={isLoading || disabled}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending magic link...
            </>
          ) : (
            "Send Magic Link & Continue"
          )}
        </Button>
        <p className="text-xs text-muted-foreground text-center mt-2">
          We'll send you a secure link to continue with your purchase.
        </p>
      </form>
    </Form>
  );
}
