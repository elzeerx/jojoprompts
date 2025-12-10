import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { checkoutSignupSchema, type CheckoutSignupFormValues, splitFullName, generateUsernameFromEmail } from "@/components/auth/validation";
import { createLogger } from '@/utils/logging';
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

const logger = createLogger('CHECKOUT_SIGNUP');

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
  const [password, setPassword] = useState("");
  const { toast } = useToast();
  const { t, isRTL } = useTranslation();

  const form = useForm<CheckoutSignupFormValues>({
    resolver: zodResolver(checkoutSignupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
    },
  });

  const handleSignup = async (values: CheckoutSignupFormValues) => {
    if (disabled) return;
    
    setIsLoading(true);

    try {
      // Split full name into first and last name
      const { firstName, lastName } = splitFullName(values.fullName);
      
      // Auto-generate username from email
      const username = generateUsernameFromEmail(values.email);

      logger.debug('Starting email/password signup', { email: values.email });

      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName || firstName,
            username: username,
          },
          // Skip email confirmation for faster checkout
          emailRedirectTo: undefined
        }
      });

      if (error) {
        logger.error('Signup failed', { error: error.message });
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

      logger.info('Signup successful', { userId: data.user.id });
      
      toast({
        title: "Account created! 🎉",
        description: "Welcome! You can now complete your purchase.",
      });

      onSuccess();
    } catch (error: any) {
      logger.error('Unexpected signup error', { error: error.message || error });
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
        <AlertDescription className={cn(isRTL && "rtl-text")}>
          {t('auth.checkoutSignupNote')}
        </AlertDescription>
      </Alert>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSignup)} className="space-y-4">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={cn(isRTL && "rtl-text")}>
                  {t('auth.fullName')}
                </FormLabel>
                <FormControl>
                  <Input 
                    placeholder={t('auth.fullNamePlaceholder')} 
                    className={cn("min-h-[44px]", isRTL && "text-right rtl-text")}
                    dir={isRTL ? "rtl" : "ltr"}
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
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={cn(isRTL && "rtl-text")}>
                  {t('auth.email')}
                </FormLabel>
                <FormControl>
                  <Input 
                    type="email" 
                    placeholder={t('auth.emailPlaceholder')} 
                    className={cn("min-h-[44px]", isRTL && "text-right rtl-text")}
                    dir={isRTL ? "rtl" : "ltr"}
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
                <FormLabel className={cn(isRTL && "rtl-text")}>
                  {t('auth.password')}
                </FormLabel>
                <FormControl>
                  <Input 
                    type="password" 
                    placeholder={t('auth.passwordPlaceholder')} 
                    className={cn("min-h-[44px]", isRTL && "text-right rtl-text")}
                    dir={isRTL ? "rtl" : "ltr"}
                    {...field} 
                    disabled={disabled}
                    onChange={(e) => {
                      field.onChange(e);
                      setPassword(e.target.value);
                    }}
                  />
                </FormControl>
                <PasswordStrengthIndicator password={password} />
                <FormMessage />
              </FormItem>
            )}
          />

          <Button 
            type="submit" 
            className="w-full min-h-[44px]" 
            disabled={isLoading || disabled}
          >
            {isLoading ? t('auth.creatingAccount') : t('auth.createAccountAndContinue')}
          </Button>
        </form>
      </Form>

      <div className="text-center">
        <Button 
          variant="link" 
          onClick={onSwitchToLogin}
          disabled={disabled}
          className={cn(isRTL && "rtl-text")}
        >
          {t('auth.alreadyHaveAccount')} {t('auth.signIn')}
        </Button>
      </div>
    </div>
  );
}
