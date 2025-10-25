
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createLogger } from '@/utils/logging';
import { handleError } from '@/utils/errorHandler';

const logger = createLogger('FORGOT_PASSWORD');
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { ForgotPasswordFormValues, forgotPasswordSchema } from "./validation";

export function ForgotPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);
  const { toast } = useToast();

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setIsLoading(true);

    try {
      const origin = window.location.origin;
      // Update redirect URL to use the reset-password route with type parameter
      const resetUrl = `${origin}/login?type=recovery&tab=reset`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(
        values.email,
        {
          redirectTo: resetUrl,
        }
      );

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
      } else {
        setResetRequested(true);
        toast({
          title: "Password Reset Email Sent",
          description: "Check your inbox for the password reset link.",
        });
      }
    } catch (error) {
      const appError = handleError(error, { component: 'ForgotPasswordForm', action: 'requestReset' });
      logger.error('Password reset request error', appError);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
    }

    setIsLoading(false);
  };

  if (resetRequested) {
    return (
      <div className="text-center py-4">
        <p className="mb-4">Password reset email sent!</p>
        <p className="text-sm text-muted-foreground">
          Check your inbox for a link to reset your password. If it doesn't appear
          within a few minutes, check your spam folder.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-4 w-full"
          onClick={() => {
            setResetRequested(false);
            form.reset();
          }}
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
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
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            "Send Reset Link"
          )}
        </Button>
      </form>
    </Form>
  );
}
