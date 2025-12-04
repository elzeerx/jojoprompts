import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, ArrowRight, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GoogleAuthButton } from "./components/GoogleAuthButton";
import { TrustSignals } from "./components/TrustSignals";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { splitFullName, generateUsernameFromEmail } from "@/components/auth/validation";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { logInfo, logError, logDebug } from "@/utils/secureLogging";

interface SmartAuthFormProps {
  onSuccess: () => void;
  planName: string;
  planPrice: number;
}

type AuthStep = 'email' | 'login' | 'signup';

export function SmartAuthForm({ onSuccess, planName, planPrice }: SmartAuthFormProps) {
  const { t, isRTL } = useTranslation();
  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

  const checkEmailExists = useCallback(async (emailToCheck: string) => {
    setIsCheckingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-email-exists', {
        body: { email: emailToCheck.trim().toLowerCase() }
      });

      if (error) {
        logError('Email check error', 'auth', { error: error.message });
        // On error, default to signup flow
        return false;
      }

      return data?.exists ?? false;
    } catch (err) {
      logError('Email check exception', 'auth', { error: err });
      return false;
    } finally {
      setIsCheckingEmail(false);
    }
  }, []);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      toast({
        variant: "destructive",
        title: t('validation.invalidEmail'),
        description: t('auth.emailPlaceholder'),
      });
      return;
    }

    logDebug('Checking if email exists', 'auth', { email });
    const exists = await checkEmailExists(email);
    
    if (exists) {
      logInfo('Existing user detected, showing login', 'auth');
      setStep('login');
    } else {
      logInfo('New user detected, showing signup', 'auth');
      setStep('signup');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      logInfo('Attempting login from smart checkout', 'auth');
      const { error, data } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        logError('Login error', 'auth', { error: error.message });
        toast({
          variant: "destructive",
          title: "Login failed",
          description: error.message,
        });
      } else {
        logInfo('User logged in successfully', 'auth', undefined, data.user?.id);
        toast({
          title: t('auth.welcomeBack'),
          description: "You can now complete your purchase.",
        });
        onSuccess();
      }
    } catch (error: any) {
      logError('Login exception', 'auth', { error: error.message });
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fullName || fullName.trim().length < 2) {
      toast({
        variant: "destructive",
        title: t('validation.fullNameMin'),
      });
      return;
    }

    if (password.length < 8) {
      toast({
        variant: "destructive",
        title: t('validation.passwordMin'),
      });
      return;
    }

    setIsLoading(true);

    try {
      const { firstName, lastName } = splitFullName(fullName);
      const username = generateUsernameFromEmail(email);

      logInfo('Attempting signup from smart checkout', 'auth');

      // Validate signup
      const { data: validationData, error: validationError } = await supabase.functions.invoke('validate-signup', {
        body: {
          email: email.trim(),
          username,
          firstName,
          lastName: lastName || firstName,
          ipAddress: window.location.hostname
        }
      });

      if (validationError || !validationData?.valid) {
        const errorMsg = validationData?.errors?.[0] || validationError?.message || 'Validation failed';
        logError('Signup validation failed', 'auth', { error: errorMsg });
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: errorMsg,
        });
        setIsLoading(false);
        return;
      }

      // Create account
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName || firstName,
            username,
          },
          emailRedirectTo: `${window.location.origin}/checkout`
        }
      });

      if (error) {
        logError('Signup error', 'auth', { error: error.message });
        toast({
          variant: "destructive",
          title: "Signup failed",
          description: error.message,
        });
      } else if (data?.user) {
        logInfo('User signed up successfully', 'auth', undefined, data.user.id);
        toast({
          title: "Account Created! 🎉",
          description: "You can now complete your purchase.",
        });
        onSuccess();
      }
    } catch (error: any) {
      logError('Signup exception', 'auth', { error: error.message });
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep('email');
    setPassword('');
    setFullName('');
  };

  return (
    <Card className="w-full">
      <CardHeader className="text-center pb-4">
        <div className="flex justify-center mb-3">
          <div className="rounded-full bg-warm-gold/10 p-3">
            <User className="h-6 w-6 text-warm-gold" />
          </div>
        </div>
        <CardTitle className={cn("text-xl", isRTL && "rtl-text")}>
          {step === 'email' && t('auth.continueWithEmail')}
          {step === 'login' && t('auth.welcomeBack')}
          {step === 'signup' && t('auth.createAccount')}
        </CardTitle>
        <div className="bg-green-50 border border-green-100 rounded-md p-3 mt-3">
          <p className={cn("text-sm text-green-800 text-center", isRTL && "rtl-text")}>
            {t('checkout.purchasing')} <strong>{planName}</strong> {t('checkout.for')} <strong>${planPrice}</strong>
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <TrustSignals />

        {/* Google Auth - Always visible */}
        <GoogleAuthButton />

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className={cn("bg-background px-2 text-muted-foreground", isRTL && "rtl-text")}>
              {t('auth.orContinueWith')}
            </span>
          </div>
        </div>

        {/* Step 1: Email Input */}
        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className={cn(isRTL && "rtl-text")}>
                {t('auth.email')}
              </Label>
              <div className="relative">
                <Mail className={cn(
                  "absolute top-3 h-4 w-4 text-muted-foreground",
                  isRTL ? "right-3" : "left-3"
                )} />
                <Input
                  id="email"
                  type="email"
                  placeholder={t('auth.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={cn("min-h-[44px]", isRTL ? "pr-10 text-right" : "pl-10")}
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full min-h-[44px]" 
              disabled={isCheckingEmail || !email}
            >
              {isCheckingEmail ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('common.loading')}
                </>
              ) : (
                <>
                  {t('common.next')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        )}

        {/* Step 2a: Login Form (existing user) */}
        {step === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-md p-3">
              <p className={cn("text-sm text-blue-800", isRTL && "rtl-text")}>
                {t('auth.welcomeBack')} <strong>{email}</strong>
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className={cn(isRTL && "rtl-text")}>
                {t('auth.password')}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder={t('auth.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn("min-h-[44px]", isRTL && "text-right")}
                autoComplete="current-password"
                autoFocus
              />
            </div>

            <Button 
              type="submit" 
              className="w-full min-h-[44px]" 
              disabled={isLoading || !password}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('auth.signingIn')}
                </>
              ) : (
                t('auth.signIn') + " & " + t('common.next')
              )}
            </Button>

            <Button 
              type="button" 
              variant="ghost" 
              className="w-full" 
              onClick={handleBackToEmail}
            >
              {t('auth.useAnotherEmail')}
            </Button>
          </form>
        )}

        {/* Step 2b: Signup Form (new user) */}
        {step === 'signup' && (
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="bg-green-50 border border-green-100 rounded-md p-3">
              <p className={cn("text-sm text-green-800", isRTL && "rtl-text")}>
                {t('auth.creatingAccountFor')} <strong>{email}</strong>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName" className={cn(isRTL && "rtl-text")}>
                {t('auth.fullName')}
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder={t('auth.fullNamePlaceholder')}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={cn("min-h-[44px]", isRTL && "text-right")}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signupPassword" className={cn(isRTL && "rtl-text")}>
                {t('auth.password')}
              </Label>
              <Input
                id="signupPassword"
                type="password"
                placeholder={t('auth.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn("min-h-[44px]", isRTL && "text-right")}
                autoComplete="new-password"
              />
              <PasswordStrengthIndicator password={password} />
            </div>

            <Button 
              type="submit" 
              className="w-full min-h-[44px]" 
              disabled={isLoading || !fullName || !password}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('auth.creatingAccount')}
                </>
              ) : (
                t('auth.createAccountAndContinue')
              )}
            </Button>

            <Button 
              type="button" 
              variant="ghost" 
              className="w-full" 
              onClick={handleBackToEmail}
            >
              {t('auth.useAnotherEmail')}
            </Button>
          </form>
        )}

        <p className={cn("text-xs text-muted-foreground text-center", isRTL && "rtl-text")}>
          {t('auth.checkoutSignupNote')}
        </p>
      </CardContent>
    </Card>
  );
}
