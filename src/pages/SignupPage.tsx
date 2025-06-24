
import { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/components/ui/use-toast";
import { SignupFormValues, signupSchema } from "@/components/auth/validation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileText, ShoppingBag, Loader2 } from "lucide-react";

export default function SignupPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  // Check for plan parameter or fromCheckout
  const selectedPlan = searchParams.get('plan');
  const fromCheckout = searchParams.get('fromCheckout') === 'true';

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
    },
  });

  const handleSubmit = async (values: SignupFormValues) => {
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
        toast({
          variant: "destructive",
          title: "Error",
          description: signupError.message,
        });
        setIsLoading(false);
        return;
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

  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true);

    try {
      // Build redirect URL for Google OAuth
      let redirectUrl = `${window.location.origin}/prompts`;
      
      if (selectedPlan) {
        redirectUrl = `${window.location.origin}/checkout?plan_id=${selectedPlan}&from_signup=true`;
      } else if (fromCheckout) {
        redirectUrl = `${window.location.origin}/checkout?from_signup=true`;
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
      console.error("Google sign-up error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
    }

    setIsGoogleLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-9rem)] mobile-container-padding mobile-section-padding">
      <Card className="mx-auto max-w-sm w-full border-2 border-warm-gold/20 rounded-2xl shadow-xl bg-white/95 backdrop-blur-sm">
        <CardHeader className="space-y-2 px-4 sm:px-6 pt-6 pb-4">
          <div className="flex justify-center mb-2">
            <div className="rounded-full bg-primary/10 p-3 text-primary">
              {(fromCheckout || selectedPlan) ? <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6" /> : <FileText className="h-5 w-5 sm:h-6 sm:w-6" />}
            </div>
          </div>
          <CardTitle className="text-xl sm:text-2xl font-bold text-center text-dark-base">Sign Up</CardTitle>
          <CardDescription className="text-center text-sm sm:text-base">
            {(fromCheckout || selectedPlan)
              ? "Create an account to complete your subscription" 
              : "Create an account to browse and save prompts"}
          </CardDescription>
          
          {selectedPlan && (
            <div className="bg-green-50 border border-green-100 rounded-md p-3 mt-2">
              <p className="text-xs sm:text-sm text-green-800 text-center">
                After creating your account, you'll receive a confirmation email. Click the link to proceed directly to checkout!
              </p>
            </div>
          )}
          
          {fromCheckout && (
            <div className="bg-green-50 border border-green-100 rounded-md p-3 mt-2">
              <p className="text-xs sm:text-sm text-green-800 text-center">
                Your payment was successful! Create an account to activate your subscription.
              </p>
            </div>
          )}
        </CardHeader>
        
        <CardContent className="space-y-4 px-4 sm:px-6">
          {/* Google Sign Up Button */}
          <Button
            type="button"
            variant="outline"
            className="w-full mobile-button-secondary touch-target"
            onClick={handleGoogleSignUp}
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
            <span className="text-sm sm:text-base">Continue with Google</span>
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
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} className="mobile-input" />
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
                      <FormLabel className="text-sm font-medium">Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} className="mobile-input" />
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
                    <FormLabel className="text-sm font-medium">Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="name@example.com" {...field} className="mobile-input" />
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
                    <FormLabel className="text-sm font-medium">Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} className="mobile-input" />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">
                      Must be at least 8 characters long
                    </p>
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full mobile-button-primary" disabled={isLoading || isGoogleLoading}>
                {isLoading ? "Creating account..." : "Create Account"}
              </Button>
            </form>
          </Form>
        </CardContent>
        
        <CardFooter className="flex flex-col space-y-4 px-4 sm:px-6 pb-6">
          <p className="text-xs sm:text-sm text-muted-foreground text-center">
            Already have an account?{" "}
            <Button 
              variant="link" 
              className="p-0 text-xs sm:text-sm text-warm-gold hover:text-warm-gold/80" 
              onClick={() => {
                const params = selectedPlan ? `?plan=${selectedPlan}` : "";
                navigate(`/login${params}`);
              }}
            >
              Sign in
            </Button>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
