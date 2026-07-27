
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock } from "lucide-react";
import { createLocalizedSchemas, LoginFormValues, MagicLinkFormValues } from "./validation/schemas";
import { CheckoutContextManager } from "@/utils/checkoutContext";
import { createLogger } from "@/utils/logging";
import { securityLogger } from "@/utils/logging/security";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { isLaunchLocked } from "@/config/siteMode";
import { resolveSafeNext, DEFAULT_SAFE_NEXT } from "@/lib/v2/safeNext";

const LAUNCH_LOCKED = isLaunchLocked();

type AuthMode = 'password' | 'magic-link';

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('password');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { t, isRTL } = useTranslation();
  
  const logger = createLogger('LOGIN_FORM');
  
  // V2: `next` = same-origin post-auth destination validated by resolveSafeNext.
  // `redirect` / `plan` are legacy inputs that MUST NOT override a safe `next`
  // or the safe /explore fallback for the active V2 flow.
  const safeNextPath = resolveSafeNext(searchParams.get("next"));
  const hasExplicitNext = !!searchParams.get("next");

  // Create localized schemas
  const schemas = createLocalizedSchemas(t);

  const passwordForm = useForm<LoginFormValues>({
    resolver: zodResolver(schemas.loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const magicLinkForm = useForm<MagicLinkFormValues>({
    resolver: zodResolver(schemas.magicLinkSchema),
    defaultValues: {
      email: "",
    },
  });

  const onPasswordSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    
    // Log login attempt
    securityLogger.loginAttempt(undefined, { email: values.email, method: 'password' });

    try {
      const { error, data } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        // Log failed login
        securityLogger.loginFailure(error.message, { email: values.email, method: 'password' });
        
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
      } else {
        // Log successful login
        securityLogger.loginSuccess(data.user?.id || '', { email: values.email, method: 'password' });
        
        toast({
          title: "Success!",
          description: "You have been logged in.",
        });
        
        // V2: single safe destination — never a plan-based checkout redirect.
        CheckoutContextManager.clearContext();
        if (hasExplicitNext) {
          window.location.href = safeNextPath;
        } else {
          navigate(safeNextPath);
        }
      }
    } catch (error: any) {
      // Log unexpected error
      securityLogger.loginFailure('Unexpected login error', { email: values.email, error: error.message });
      logger.error("Login error", error);
      
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
    }

    setIsLoading(false);
  };

  const onMagicLinkSubmit = async (values: MagicLinkFormValues) => {
    setIsLoading(true);

    try {
      // V2: single safe destination — never plan-gated.
      const redirectUrl = `${window.location.origin}${safeNextPath}`;

      const { error } = await supabase.auth.signInWithOtp({
        email: values.email,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
      } else {
        setMagicLinkSent(true);
        toast({
          title: "Magic link sent! ✨",
          description: "Check your email for a secure login link.",
        });
      }
    } catch (error) {
      logger.error("Magic link error", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
    }

    setIsLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);

    try {
      // V2: single safe destination — never a plan-gated URL.
      const redirectUrl = `${window.location.origin}${safeNextPath}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
      }
    } catch (error) {
      logger.error("Google sign-in error", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
    }

    setIsGoogleLoading(false);
  };

  if (magicLinkSent) {
    return (
      <div className="space-y-4 text-center">
        <div className={cn(
          "rounded-lg bg-green-50 p-4 border border-green-200",
          isRTL && "rtl-text"
        )}>
          <Mail className="h-12 w-12 text-green-600 mx-auto mb-2" />
          <h3 className="text-lg font-medium text-green-900 mb-1">{t('auth.magicLinkSent')}</h3>
          <p className="text-sm text-green-700">
            {t('auth.magicLinkSentDesc')}
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => {
            setMagicLinkSent(false);
            setAuthMode('password');
          }}
          className="w-full min-h-[44px]"
        >
          {t('auth.backToLogin')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!LAUNCH_LOCKED && (
        <>
          {/* Google Sign In Button */}
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-full min-h-[44px]",
              isRTL && "flex-row-reverse"
            )}
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isLoading}
          >
            {isGoogleLoading ? (
              <Loader2 className={cn("h-4 w-4 animate-spin", isRTL ? "ml-2" : "mr-2")} />
            ) : (
              <svg className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            {t('auth.continueWithGoogle')}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                {t('auth.orChooseMethod')}
              </span>
            </div>
          </div>
        </>
      )}


      {/* Auth Mode Toggle */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg">
        <Button
          type="button"
          variant={authMode === 'password' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setAuthMode('password')}
          className={cn("h-9 min-h-[44px]", isRTL && "flex-row-reverse")}
        >
          <Lock className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
          {t('auth.passwordMethod')}
        </Button>
        <Button
          type="button"
          variant={authMode === 'magic-link' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setAuthMode('magic-link')}
          className={cn("h-9 min-h-[44px]", isRTL && "flex-row-reverse")}
        >
          <Mail className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
          {t('auth.magicLinkMethod')}
        </Button>
      </div>

      {/* Password Form */}
      {authMode === 'password' && (
        <Form {...passwordForm}>
          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
            <FormField
              control={passwordForm.control}
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

            <FormField
              control={passwordForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={isRTL ? "rtl-text" : ""}>{t('auth.password')}</FormLabel>
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder={t('auth.passwordPlaceholder')}
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
              disabled={isLoading || isGoogleLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className={cn("h-4 w-4 animate-spin", isRTL ? "ml-2" : "mr-2")} />
                  {t('auth.signingIn')}
                </>
              ) : (
                <>
                  <Lock className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
                  {t('auth.signIn')}
                </>
              )}
            </Button>
          </form>
        </Form>
      )}

      {/* Magic Link Form */}
      {authMode === 'magic-link' && (
        <Form {...magicLinkForm}>
          <form onSubmit={magicLinkForm.handleSubmit(onMagicLinkSubmit)} className="space-y-4">
            <FormField
              control={magicLinkForm.control}
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
              disabled={isLoading || isGoogleLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className={cn("h-4 w-4 animate-spin", isRTL ? "ml-2" : "mr-2")} />
                  {t('auth.sendingMagicLink')}
                </>
              ) : (
                <>
                  <Mail className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
                  {t('auth.sendMagicLink')}
                </>
              )}
            </Button>

            <p className={cn(
              "text-sm text-muted-foreground text-center",
              isRTL && "rtl-text"
            )}>
              {t('auth.magicLinkInfo')}
            </p>
          </form>
        </Form>
      )}
      
      {!LAUNCH_LOCKED && selectedPlan && (
        <div className={cn("pt-2 text-center", isRTL && "rtl-text")}>
          <p className="text-sm text-muted-foreground">
            {t('auth.dontHaveAccount')}{" "}
            <Button 
              variant="link" 
              className="p-0" 
              onClick={() => navigate(`/signup?plan=${selectedPlan}`)}
            >
              {t('auth.signUp')}
            </Button>
          </p>
        </div>
      )}
    </div>
  );
}
