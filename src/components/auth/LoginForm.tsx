
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock } from "lucide-react";
import { LoginFormValues, MagicLinkFormValues, loginSchema, magicLinkSchema } from "./validation";

type AuthMode = 'password' | 'magic-link';

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('password');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  // Check for redirect and plan parameters
  const redirectTo = searchParams.get('redirect');
  const selectedPlan = searchParams.get('plan');

  const passwordForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const magicLinkForm = useForm<MagicLinkFormValues>({
    resolver: zodResolver(magicLinkSchema),
    defaultValues: {
      email: "",
    },
  });

  const onPasswordSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
      } else {
        toast({
          title: "Success!",
          description: "You have been logged in.",
        });
        
        // Handle redirection based on parameters
        if (selectedPlan) {
          navigate(`/checkout?plan_id=${selectedPlan}`);
        } else if (redirectTo) {
          navigate(`/${redirectTo}`);
        } else {
          navigate("/prompts");
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
    }

    setIsLoading(false);
  };

  const onMagicLinkSubmit = async (values: MagicLinkFormValues) => {
    setIsLoading(true);

    try {
      // Build redirect URL based on current context
      let redirectUrl = `${window.location.origin}/prompts`;
      
      // If we're on checkout page or have plan parameters, preserve that context
      if (selectedPlan) {
        redirectUrl = `${window.location.origin}/checkout?plan_id=${selectedPlan}`;
      } else if (redirectTo) {
        redirectUrl = `${window.location.origin}/${redirectTo}`;
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: values.email,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
      } else {
        setMagicLinkSent(true);
        toast({
          title: "Magic link sent! ✨",
          description: "Check your email for a secure login link.",
        });
      }
    } catch (error) {
      console.error("Magic link error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
    }

    setIsLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);

    try {
      // Build redirect URL based on current context
      let redirectUrl = `${window.location.origin}/prompts`;
      
      // If we're on checkout page or have plan parameters, preserve that context
      const currentPath = window.location.pathname;
      const currentSearch = window.location.search;
      
      if (currentPath === '/checkout' || currentSearch.includes('plan_id=') || selectedPlan) {
        // Preserve the current checkout context
        redirectUrl = `${window.location.origin}${currentPath}${currentSearch}`;
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
      }
    } catch (error) {
      console.error("Google sign-in error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
    }

    setIsGoogleLoading(false);
  };

  if (magicLinkSent) {
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-lg bg-green-50 p-4 border border-green-200">
          <Mail className="h-12 w-12 text-green-600 mx-auto mb-2" />
          <h3 className="text-lg font-medium text-green-900 mb-1">Magic link sent!</h3>
          <p className="text-sm text-green-700">
            We've sent a secure login link to your email. Click the link to sign in instantly.
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => {
            setMagicLinkSent(false);
            setAuthMode('password');
          }}
          className="w-full"
        >
          Back to login options
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Google Sign In Button */}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGoogleSignIn}
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
            Or choose your login method
          </span>
        </div>
      </div>

      {/* Auth Mode Toggle */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg">
        <Button
          type="button"
          variant={authMode === 'password' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setAuthMode('password')}
          className="h-9"
        >
          <Lock className="mr-2 h-4 w-4" />
          Password
        </Button>
        <Button
          type="button"
          variant={authMode === 'magic-link' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setAuthMode('magic-link')}
          className="h-9"
        >
          <Mail className="mr-2 h-4 w-4" />
          Magic Link
        </Button>
      </div>

      {/* Password Form */}
      {authMode === 'password' && (
        <Form {...passwordForm}>
          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
            <FormField
              control={passwordForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="name@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={passwordForm.control}
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
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Sign In
                </>
              )}
            </Button>
          </form>
        </Form>
      )}

      {/* Magic Link Form */}
      {authMode === 'magic-link' && (
        <Form {...magicLinkForm}>
          <form onSubmit={magicLinkForm.handleSubmit(onMagicLinkSubmit)} className="space-y-4">
            <FormField
              control={magicLinkForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="name@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isLoading || isGoogleLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending magic link...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Magic Link
                </>
              )}
            </Button>

            <p className="text-sm text-muted-foreground text-center">
              We'll send you a secure link to sign in instantly without a password.
            </p>
          </form>
        </Form>
      )}
      
      {selectedPlan && (
        <div className="pt-2 text-center">
          <p className="text-sm text-muted-foreground">
            Don't have an account yet?{" "}
            <Button variant="link" className="p-0" onClick={() => navigate(`/signup?plan=${selectedPlan}`)}>
              Sign up
            </Button>
          </p>
        </div>
      )}
    </div>
  );
}
