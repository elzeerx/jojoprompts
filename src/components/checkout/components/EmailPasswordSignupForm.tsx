import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { checkoutSignupSchema, type CheckoutSignupFormValues } from "@/components/auth/validation";

interface EmailPasswordSignupFormProps {
  onSuccess: () => void;
  onSwitchToLogin: () => void;
  disabled?: boolean;
}

export function EmailPasswordSignupForm({ 
  onSuccess, 
  onSwitchToLogin, 
  disabled = false 
}: EmailPasswordSignupFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<CheckoutSignupFormValues>({
    resolver: zodResolver(checkoutSignupSchema),
    defaultValues: {
      firstName: "",
      lastName: "", 
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const handleSignup = async (values: CheckoutSignupFormValues) => {
    if (disabled) return;
    
    setIsLoading(true);

    try {
      console.log("Starting direct email/password signup for checkout...");

      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            first_name: values.firstName,
            last_name: values.lastName,
          },
          // Skip email confirmation for faster checkout
          emailRedirectTo: undefined
        }
      });

      if (error) {
        console.error("Checkout signup error:", error);
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

      console.log("Checkout signup successful:", data.user.id);
      
      toast({
        title: "Account created! 🎉",
        description: "Welcome! You can now complete your purchase.",
      });

      onSuccess();
    } catch (error) {
      console.error("Unexpected signup error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription>
          Create your account to continue with your purchase. No email confirmation required.
        </AlertDescription>
      </Alert>
      
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
                    <Input placeholder="John" {...field} disabled={disabled} />
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
                    <Input placeholder="Doe" {...field} disabled={disabled} />
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
                  <Input 
                    type="email" 
                    placeholder="name@example.com" 
                    {...field} 
                    disabled={disabled}
                  />
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
                  <Input 
                    type="password" 
                    placeholder="Enter your password" 
                    {...field} 
                    disabled={disabled}
                  />
                </FormControl>
                <FormMessage />
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
                  <Input 
                    type="password" 
                    placeholder="Confirm your password" 
                    {...field} 
                    disabled={disabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading || disabled}
          >
            {isLoading ? "Creating account..." : "Create Account & Continue"}
          </Button>
        </form>
      </Form>

      <div className="text-center">
        <Button 
          variant="link" 
          onClick={onSwitchToLogin}
          disabled={disabled}
        >
          Already have an account? Sign in
        </Button>
      </div>
    </div>
  );
}