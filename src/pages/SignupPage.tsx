
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
import { FileText, ShoppingBag } from "lucide-react";

export default function SignupPage() {
  const [isLoading, setIsLoading] = useState(false);
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
      // Step 1: Sign up the user
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            first_name: values.firstName,
            last_name: values.lastName,
          },
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

      // Step 2: Automatically sign in the user
      const { error: signinError } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (signinError) {
        toast({
          variant: "destructive",
          title: "Account created but couldn't sign in automatically",
          description: "Please proceed to login with your new credentials.",
        });
        navigate("/login");
      } else {
        // Successful signup and signin
        toast({
          title: "Welcome!",
          description: (fromCheckout || selectedPlan) 
            ? "Your account has been created. Please complete your subscription." 
            : "Your account has been created and you're now logged in.",
        });
        
        // If coming from plan selection or checkout, redirect to checkout
        if (selectedPlan) {
          navigate(`/checkout?plan=${selectedPlan}`);
        } else if (fromCheckout) {
          navigate("/checkout");
        } else {
          navigate("/prompts");
        }
      }
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

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-9rem)] p-4 md:p-8">
      <Card className="mx-auto max-w-sm w-full">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-2">
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              {(fromCheckout || selectedPlan) ? <ShoppingBag className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">Sign Up</CardTitle>
          <CardDescription className="text-center">
            {(fromCheckout || selectedPlan)
              ? "Create an account to complete your subscription" 
              : "Create an account to browse and save prompts"}
          </CardDescription>
          
          {selectedPlan && (
            <div className="bg-green-50 border border-green-100 rounded-md p-3 mt-2">
              <p className="text-sm text-green-800 text-center">
                You're one step away from accessing premium prompts! Create your account to continue.
              </p>
            </div>
          )}
          
          {fromCheckout && (
            <div className="bg-green-50 border border-green-100 rounded-md p-3 mt-2">
              <p className="text-sm text-green-800 text-center">
                Your payment was successful! Create an account to activate your subscription.
              </p>
            </div>
          )}
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <CardContent className="space-y-4">
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
                      Must be at least 6 characters long
                    </p>
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Creating account..." : "Create Account"}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Already have an account?{" "}
                <Button 
                  variant="link" 
                  className="p-0" 
                  onClick={() => {
                    const params = selectedPlan ? `?plan=${selectedPlan}` : "";
                    navigate(`/login${params}`);
                  }}
                >
                  Sign in
                </Button>
              </p>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
