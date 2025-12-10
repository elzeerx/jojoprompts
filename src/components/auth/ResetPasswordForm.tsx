import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
    const token = searchParams.get('access_token') || searchParams.get('token');
    const type = searchParams.get('type');
    
    if (token && type === 'recovery') {
      setHasResetToken(true);
      setError(null);
    } else {
      setError(t('auth.noResetToken'));
    }
  }, [searchParams, t]);

  const onSubmit = async (values: ResetPasswordFormValues) => {
    setIsLoading(true);
    setError(null);

    try {
      const token = searchParams.get('access_token') || searchParams.get('token');
      
      if (!token) {
        throw new Error("No reset token found");
      }

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
          title: t('common.error'),
          description: error.message,
        });
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: values.password,
      });

      if (updateError) {
        setError(updateError.message);
        toast({
          variant: "destructive",
          title: t('common.error'),
          description: updateError.message,
        });
        return;
      }

      await supabase.auth.signOut();
      
      toast({
        title: t('auth.passwordUpdated'),
        description: t('auth.passwordUpdatedDesc'),
      });
      
      onSuccess();
    } catch (error: any) {
      const appError = handleError(error, { component: 'ResetPasswordForm', action: 'updatePassword' });
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

  return (
    <div className="space-y-4 pt-4">
      {error && (
        <Alert variant="destructive" className={isRTL ? "rtl-text" : ""}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!hasResetToken && (
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

      {hasResetToken && (
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
