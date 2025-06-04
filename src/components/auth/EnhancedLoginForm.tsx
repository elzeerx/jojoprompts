
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Lock, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { SecurityEnforcer } from "@/utils/enhancedSecurity";
import { InputValidator } from "@/utils/inputValidation";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface EnhancedLoginFormProps {
  onSuccess?: () => void;
  onSwitchToSignup?: () => void;
}

export function EnhancedLoginForm({ onSuccess, onSwitchToSignup }: EnhancedLoginFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setRateLimitError(null);
    
    // Check rate limiting
    const rateLimitCheck = SecurityEnforcer.checkAuthRateLimit('login', values.email);
    if (!rateLimitCheck.allowed) {
      const message = `Too many login attempts. Please try again in ${rateLimitCheck.retryAfter} seconds.`;
      setRateLimitError(message);
      SecurityEnforcer.logAuthAttempt('login', values.email, false, 'Rate limited');
      return;
    }

    // Validate input
    const validation = SecurityEnforcer.validateUserInput({
      email: values.email,
      password: values.password
    });

    if (!validation.isValid) {
      toast({
        variant: "destructive",
        title: "Invalid Input",
        description: validation.errors.join(', ')
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        SecurityEnforcer.logAuthAttempt('login', values.email, false, error.message);
        
        // Check for suspicious activity
        SecurityEnforcer.detectSuspiciousActivity('login_failure', {
          email: values.email.split('@')[1] // Log only domain for privacy
        });

        toast({
          variant: "destructive",
          title: "Login Failed",
          description: error.message,
        });
      } else {
        SecurityEnforcer.logAuthAttempt('login', values.email, true);
        
        toast({
          title: "Welcome back!",
          description: "You have been logged in successfully.",
        });

        // Clear form data securely
        form.reset();
        SecurityEnforcer.secureClearSensitiveData(values);
        
        onSuccess?.();
      }
    } catch (error: any) {
      SecurityEnforcer.logAuthAttempt('login', values.email, false, error.message);
      
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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {rateLimitError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{rateLimitError}</AlertDescription>
          </Alert>
        )}

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
                  disabled={isLoading}
                  autoComplete="email"
                  {...field} 
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
                  disabled={isLoading}
                  autoComplete="current-password"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button 
          type="submit" 
          className="w-full" 
          disabled={isLoading || !!rateLimitError}
        >
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

        {onSwitchToSignup && (
          <div className="text-center">
            <Button
              type="button"
              variant="link"
              onClick={onSwitchToSignup}
              disabled={isLoading}
            >
              Don't have an account? Sign up
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}
