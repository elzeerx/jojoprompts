
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { LoginFormValues, loginSchema } from "@/components/auth/validation";
import { supabase } from "@/integrations/supabase/client";
import { logInfo, logError, logDebug } from "@/utils/secureLogging";

interface LoginFormProps {
  onSuccess: () => void;
  disabled?: boolean;
}

export function LoginForm({ onSuccess, disabled }: LoginFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: "onSubmit",
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const handleLogin = async (values: LoginFormValues) => {
    logInfo("Starting login process from checkout", "auth");
    logDebug("Login form submission", "auth", { 
      email: values.email, 
      hasPassword: !!values.password,
      passwordLength: values.password?.length || 0
    });
    setIsLoading(true);

    try {
      logDebug("Attempting to sign in user", "auth", { email: values.email });
      
      const { error, data } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        logError("Login error", "auth", { error: error.message });
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
      } else {
        logInfo("User logged in successfully", "auth", undefined, data.user?.id);
        toast({
          title: "Welcome back!",
          description: "You have been logged in. Please complete your purchase.",
        });
        onSuccess();
      }
    } catch (error: any) {
      logError("Login error", "auth", { error: error.message });
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
      <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-4">
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
                  autoComplete="email"
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
                  {...field}
                  autoComplete="current-password"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isLoading || disabled}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign In & Continue"
          )}
        </Button>
      </form>
    </Form>
  );
}
