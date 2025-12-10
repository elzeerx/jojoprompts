import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createLogger } from '@/utils/logging';
import { handleError } from '@/utils/errorHandler';
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
import { createLocalizedSchemas, ForgotPasswordFormValues } from "./validation/schemas";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

const logger = createLogger('FORGOT_PASSWORD');

export function ForgotPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);
  const { toast } = useToast();
  const { t, isRTL } = useTranslation();

  // Create localized schema
  const schemas = createLocalizedSchemas(t);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(schemas.forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setIsLoading(true);

    try {
      // Use custom password reset edge function (uses Resend)
      const { data, error } = await supabase.functions.invoke('send-password-reset', {
        body: { email: values.email }
      });

      if (error) {
        logger.error('Password reset request failed', { error });
        toast({
          variant: "destructive",
          title: t('common.error'),
          description: error.message || 'Failed to send password reset email',
        });
      } else if (data && !data.success) {
        toast({
          variant: "destructive",
          title: t('common.error'),
          description: data.error || 'Failed to send password reset email',
        });
      } else {
        setResetRequested(true);
        toast({
          title: t('auth.passwordResetSent'),
          description: t('auth.checkInbox'),
        });
      }
    } catch (error) {
      const appError = handleError(error, { component: 'ForgotPasswordForm', action: 'requestReset' });
      logger.error('Password reset request error', appError);
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: "An unexpected error occurred. Please try again.",
      });
    }

    setIsLoading(false);
  };

  if (resetRequested) {
    return (
      <div className={cn("text-center py-4", isRTL && "rtl-text")}>
        <p className="mb-4">{t('auth.passwordResetSuccess')}</p>
        <p className="text-sm text-muted-foreground">
          {t('auth.passwordResetDesc')}
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-4 w-full min-h-[44px]"
          onClick={() => {
            setResetRequested(false);
            form.reset();
          }}
        >
          {t('auth.tryAgain')}
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
              <FormLabel className={isRTL ? "rtl-text" : ""}>{t('auth.email')}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder={t('auth.emailPlaceholder')}
                  className={cn("min-h-[44px]", isRTL && "text-right rtl-text")}
                  dir={isRTL ? "rtl" : "ltr"}
                  {...field}
                />
              </FormControl>
              <FormMessage className={isRTL ? "rtl-text" : ""} />
            </FormItem>
          )}
        />

        <Button 
          type="submit" 
          className={cn(
            "w-full min-h-[44px]",
            isRTL && "flex-row-reverse"
          )} 
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className={cn("h-4 w-4 animate-spin", isRTL ? "ml-2" : "mr-2")} />
              {t('auth.sending')}
            </>
          ) : (
            t('auth.sendResetLink')
          )}
        </Button>
      </form>
    </Form>
  );
}
