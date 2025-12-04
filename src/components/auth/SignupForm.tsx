import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { SignupFormValues } from "./validation/schemas";
import { UseFormReturn } from "react-hook-form";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { PasswordStrengthIndicator } from "./PasswordStrengthIndicator";
import { useState } from "react";

interface SignupFormProps {
  form: UseFormReturn<SignupFormValues>;
  isLoading: boolean;
  isGoogleLoading: boolean;
  onSubmit: (values: SignupFormValues) => void;
  onFormError: (errors: any) => void;
}

export function SignupForm({ 
  form, 
  isLoading, 
  isGoogleLoading, 
  onSubmit, 
  onFormError 
}: SignupFormProps) {
  const { t, isRTL } = useTranslation();
  const [password, setPassword] = useState("");
  
  return (
    <Form {...form}>
      <form 
        onSubmit={form.handleSubmit(onSubmit, onFormError)} 
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={cn("text-sm font-medium", isRTL && "rtl-text")}>
                {t('auth.fullName')}
              </FormLabel>
              <FormControl>
                <Input 
                  placeholder={t('auth.fullNamePlaceholder')} 
                  className={cn("mobile-input min-h-[44px]", isRTL && "text-right rtl-text")}
                  dir={isRTL ? "rtl" : "ltr"}
                  {...field} 
                />
              </FormControl>
              <FormMessage className={isRTL ? "rtl-text" : ""} />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={cn("text-sm font-medium", isRTL && "rtl-text")}>
                {t('auth.email')}
              </FormLabel>
              <FormControl>
                <Input 
                  type="email" 
                  placeholder={t('auth.emailPlaceholder')} 
                  className={cn("mobile-input min-h-[44px]", isRTL && "text-right rtl-text")}
                  dir={isRTL ? "rtl" : "ltr"}
                  {...field} 
                />
              </FormControl>
              <FormMessage className={isRTL ? "rtl-text" : ""} />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={cn("text-sm font-medium", isRTL && "rtl-text")}>
                {t('auth.password')}
              </FormLabel>
              <FormControl>
                <Input 
                  type="password" 
                  placeholder={t('auth.passwordPlaceholder')} 
                  className={cn("mobile-input min-h-[44px]", isRTL && "text-right rtl-text")}
                  dir={isRTL ? "rtl" : "ltr"}
                  {...field}
                  onChange={(e) => {
                    field.onChange(e);
                    setPassword(e.target.value);
                  }}
                />
              </FormControl>
              <PasswordStrengthIndicator password={password} />
              <FormMessage className={isRTL ? "rtl-text" : ""} />
            </FormItem>
          )}
        />
        <Button 
          type="submit" 
          className={cn(
            "w-full mobile-button-primary min-h-[44px]",
            isRTL && "flex-row-reverse"
          )} 
          disabled={isLoading || isGoogleLoading}
        >
          {isLoading ? t('auth.creatingAccount') : t('auth.createAccount')}
        </Button>
        <p className={cn("text-xs text-muted-foreground text-center", isRTL && "rtl-text")}>
          {t('auth.noConfirmationRequired')}
        </p>
      </form>
    </Form>
  );
}
