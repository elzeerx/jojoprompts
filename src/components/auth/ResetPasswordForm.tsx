
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createLogger } from '@/utils/logging';
import { handleError } from '@/utils/errorHandler';

const logger = createLogger('RESET_PASSWORD');
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle } from "lucide-react";
import { ResetPasswordFormValues, resetPasswordSchema } from "./validation";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ResetPasswordFormProps {
  onSuccess: () => void;
}

export function ResetPasswordForm({ onSuccess }: ResetPasswordFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [hasResetToken, setHasResetToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  // Check for password reset token on mount
  useEffect(() => {
    const token = searchParams.get('access_token') || searchParams.get('token');
    const type = searchParams.get('type');
    
    if (token && type === 'recovery') {
      setHasResetToken(true);
      setError(null);
    } else {
      setError("No password reset token found. Please request a password reset from the 'Forgot Password' tab.");
    }
  }, [searchParams]);

  const onSubmit = async (values: ResetPasswordFormValues) => {
    setIsLoading(true);
    setError(null);

    try {
      const token = searchParams.get('access_token') || searchParams.get('token');
      
      if (!token) {
        throw new Error("No reset token found");
      }

      // Use verifyOtp for password reset instead of updateUser
      const { error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'recovery',
        options: {
          redirectTo: window.location.origin
        }
      });

      if (error) {
        setError(error.message);
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
        return;
      }

      // Now update the password using the authenticated session from verifyOtp
      const { error: updateError } = await supabase.auth.updateUser({
        password: values.password,
      });

      if (updateError) {
        setError(updateError.message);
        toast({
          variant: "destructive",
          title: "Error",
          description: updateError.message,
        });
        return;
      }

      // Sign out the user after successful password reset
      await supabase.auth.signOut();
      
      toast({
        title: "Password Updated",
        description: "Your password has been successfully updated. Please log in with your new password.",
      });
      
      // Redirect to login page
      onSuccess();
    } catch (error: any) {
      const appError = handleError(error, { component: 'ResetPasswordForm', action: 'updatePassword' });
      logger.error('Password update error', appError);
      setError("An unexpected error occurred. Please try again.");
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
    }

    setIsLoading(false);
  };

  return (
    <div className="space-y-4 pt-4">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!hasResetToken && (
        <div className="text-center py-2">
          <Button 
            variant="outline" 
            onClick={() => navigate("/login?tab=forgot")}
            className="w-full"
          >
            Request Password Reset
          </Button>
        </div>
      )}

      {hasResetToken && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
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
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </form>
        </Form>
      )}
    </div>
  );
}
