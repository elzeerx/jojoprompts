
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Lock, Shield, LogIn } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { logInfo, logError } from "@/utils/secureLogging";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface CheckoutLoginFormProps {
  onSuccess: () => void;
  onSwitchToSignup: () => void;
  planName: string;
  planPrice: number;
}

export function CheckoutLoginForm({ onSuccess, onSwitchToSignup, planName, planPrice }: CheckoutLoginFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const handleGoogleAuth = async () => {
    logInfo("Starting Google OAuth from checkout login", "auth");
    setIsGoogleLoading(true);

    try {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('auth_callback', 'google');
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: currentUrl.toString(),
        },
      });

      if (error) {
        logError("Google OAuth error", "auth", { error: error.message });
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
      } else {
        logInfo("Google OAuth initiated successfully", "auth");
      }
    } catch (error) {
      logError("Google authentication error", "auth", { error: error.message });
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
    }

    setIsGoogleLoading(false);
  };

  const handleLogin = async (values: LoginFormValues) => {
    logInfo("Starting login process from checkout", "auth");
    setIsLoading(true);

    try {
      const { error, data } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        logError("Login error", "auth", { error: error.message });
        toast({
          variant: "destructive",
          title: "Login Failed",
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
    } catch (error) {
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
    <Card className="w-full">
      <CardHeader className="text-center pb-4">
        <div className="flex justify-center mb-3">
          <div className="rounded-full bg-warm-gold/10 p-3">
            <LogIn className="h-6 w-6 text-warm-gold" />
          </div>
        </div>
        <CardTitle className="text-xl">Sign In to Continue</CardTitle>
        <div className="bg-green-50 border border-green-100 rounded-md p-3 mt-3">
          <p className="text-sm text-green-800 text-center">
            You're purchasing <strong>{planName}</strong> for <strong>${planPrice}</strong>
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Trust signals */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mb-4">
          <div className="flex items-center gap-1">
            <Lock className="h-3 w-3" />
            <span>Secure</span>
          </div>
          <div className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            <span>Protected</span>
          </div>
        </div>

        {/* Google Authentication Button */}
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogleAuth}
          disabled={isGoogleLoading || isLoading}
        >
          {isGoogleLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          Continue with Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with email
            </span>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-4">
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
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading || isGoogleLoading}>
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

        <div className="text-center">
          <Button
            variant="link"
            className="p-0 text-sm"
            onClick={onSwitchToSignup}
            disabled={isLoading || isGoogleLoading}
          >
            Don't have an account? Sign up
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
