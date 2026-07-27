import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { CheckoutSignupFormValues, checkoutSignupSchema, splitFullName, generateUsernameFromEmail } from "@/components/auth/validation";
import { supabase } from "@/integrations/supabase/client";
import { logInfo, logError, logDebug } from "@/utils/secureLogging";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

interface SignupFormProps {
  onSuccess: () => void;
  onSwitchToLogin: () => void;
  disabled?: boolean;
}

export function SignupForm({ onSuccess, onSwitchToLogin, disabled }: SignupFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState("");
  const { t, isRTL } = useTranslation();

  const form = useForm<CheckoutSignupFormValues>({
    resolver: zodResolver(checkoutSignupSchema),
    mode: "onSubmit",
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
    },
  });

  const handleSignup = async (values: CheckoutSignupFormValues) => {
    logInfo("Starting checkout signup process", "auth");
    setIsLoading(true);

    try {
      // Split full name into first and last name
      const { firstName, lastName } = splitFullName(values.fullName);
      
      // Auto-generate username from email
      const username = generateUsernameFromEmail(values.email);

      logDebug("Checkout signup form submission", "auth", { 
        email: values.email,
        firstName,
        lastName,
        username
      });

      // V2 release-hardening: no pre-signup existence probe. Supabase
      // Auth authoritatively rejects duplicates with a generic response.


      // Create account with password
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName || firstName,
            username: username,
          },
          emailRedirectTo: `${window.location.origin}/checkout`
        }
      });

      if (error) {
        logError("Signup error", "auth", { error: error.message });
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "Failed to create account. Please try again.",
        });
        setIsLoading(false);
        return;
      }

      if (!data?.user) {
        logError("No user returned from signup", "auth");
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to create account. Please try again.",
        });
        setIsLoading(false);
        return;
      }

      logInfo("Account created successfully", "auth");
      toast({
        title: "Account Created! 🎉",
        description: "You can now proceed with your purchase.",
      });

      onSuccess();
    } catch (error: any) {
      logError("Checkout signup error", "auth", { error: error.message });
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
        <Button type="submit" className="w-full min-h-[44px]" disabled={isLoading || disabled}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('auth.creatingAccount')}
            </>
          ) : (
            t('auth.createAccountAndContinue')
          )}
        </Button>
        <p className={cn("text-xs text-muted-foreground text-center mt-2", isRTL && "rtl-text")}>
          {t('auth.checkoutSignupNote')}
        </p>
      </form>
    </Form>
  );
}
