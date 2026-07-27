import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { Loader2, AlertTriangle } from "lucide-react";
import { createLocalizedSchemas, ResetPasswordFormValues } from "./validation/schemas";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

const logger = createLogger('RESET_PASSWORD');

type RecoveryStatus = "loading" | "ready" | "invalid";

interface ResetPasswordFormProps {
  onSuccess: () => void;
}

/**
 * Password reset form using Supabase Auth's official recovery-session flow.
 *
 * When the user clicks the emailed reset link, supabase-js
 * (with the default `detectSessionInUrl: true`) parses the URL fragment
 * on load, exchanges it, and fires a `PASSWORD_RECOVERY` auth event —
 * at which point `supabase.auth.updateUser({ password })` is authorized
 * to change the user's password without any custom raw-token round-trip.
 */
export function ResetPasswordForm({ onSuccess }: ResetPasswordFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<RecoveryStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, isRTL } = useTranslation();

  // Create localized schema
  const schemas = createLocalizedSchemas(t);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(schemas.resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    let cancelled = false;

    // If the recovery URL was parsed before mount, a session exists now.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        setStatus("ready");
        setError(null);
      }
    });

    // Otherwise wait for the PASSWORD_RECOVERY event; if nothing arrives
    // within a short window we mark the link invalid/expired.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setStatus("ready");
        setError(null);
      }
    });

    const timer = window.setTimeout(() => {
      if (cancelled) return;
      setStatus((prev) => {
        if (prev !== "ready") {
          setError(t('auth.noResetToken'));
          return "invalid";
        }
        return prev;
      });
    }, 2500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, [t]);

  const onSubmit = async (values: ResetPasswordFormValues) => {
    setIsLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: values.password,
      });

      if (updateError) {
        const message = /session|token|expired|jwt/i.test(updateError.message)
          ? "Reset link is invalid or has expired. Please request a new password reset."
          : updateError.message;
        setError(message);
        toast({
          variant: "destructive",
          title: t('common.error'),
          description: message,
        });
        return;
      }

      // Sign the recovery session out so the new credentials are used
      // for the next explicit login.
      await supabase.auth.signOut();

      toast({
        title: t('auth.passwordUpdated'),
        description: t('auth.passwordUpdatedDesc'),
      });

      onSuccess();
    } catch (err: any) {
      const appError = handleError(err, { component: 'ResetPasswordForm', action: 'updatePassword' });
      logger.error('Password update error', appError);
      setError("An unexpected error occurred. Please try again.");
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: "An unexpected error occurred. Please try again.",
      });
    }

    setIsLoading(false);
  };

  if (status === "loading") {
    return (
      <div className={cn("flex items-center justify-center py-8", isRTL && "rtl-text")}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      {error && (
        <Alert variant="destructive" className={isRTL ? "rtl-text" : ""}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {status === "invalid" && (
        <div className={cn("text-center py-2", isRTL && "rtl-text")}>
          <Button
            variant="outline"
            onClick={() => navigate("/login?tab=forgot")}
            className="w-full min-h-[44px]"
          >
            {t('auth.requestPasswordReset')}
          </Button>
        </div>
      )}

      {status === "ready" && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={isRTL ? "rtl-text" : ""}>{t('auth.newPassword')}</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      className={cn("min-h-[44px]", isRTL && "text-right rtl-text")}
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
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={isRTL ? "rtl-text" : ""}>{t('auth.confirmNewPassword')}</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
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
                  {t('auth.updating')}
                </>
              ) : (
                t('auth.updatePassword')
              )}
            </Button>
          </form>
        </Form>
      )}
    </div>
  );
}
