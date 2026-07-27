import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, ArrowRight, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GoogleAuthButton } from "@/components/checkout/components/GoogleAuthButton";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { DiscountCodeInput } from "@/components/checkout/DiscountCodeInput";
import { SimplePaymentSelection } from "@/components/payment/SimplePaymentSelection";
import { splitFullName, generateUsernameFromEmail } from "@/components/auth/validation";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { logInfo, logError, logDebug } from "@/utils/secureLogging";
import { useAuth } from "@/contexts/AuthContext";
import { AppliedDiscount } from "@/pages/CheckoutPage/types";
import { EnhancedTrustBadges } from "@/components/checkout/EnhancedTrustBadges";
import { MoneyBackGuarantee } from "@/components/checkout/MoneyBackGuarantee";

interface SelectedPlan {
  id: string;
  name: string;
  description?: string | null;
  price_usd: number;
  is_lifetime: boolean;
  features: string[] | any;
}

interface ExpressCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: SelectedPlan | null;
}

type AuthStep = 'email' | 'login' | 'signup' | 'payment';

export function ExpressCheckoutModal({ open, onOpenChange, plan }: ExpressCheckoutModalProps) {
  const { t, isRTL } = useTranslation();
  const { user } = useAuth();
  
  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Kept for compatibility with the existing Button `disabled` binding.
  // Enumeration-safe: we no longer probe the server for account existence.
  const isCheckingEmail = false;
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);

  // If user is already logged in, skip to payment
  useEffect(() => {
    if (user && open) {
      setStep('payment');
      setEmail(user.email || '');
    } else if (!user && open) {
      setStep('email');
    }
  }, [user, open]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setEmail('');
      setPassword('');
      setFullName('');
      setAppliedDiscount(null);
      if (!user) {
        setStep('email');
      }
    }
  }, [open, user]);

  const calculateFinalAmount = useCallback(() => {
    if (!plan) return 0;
    let finalAmount = plan.price_usd;
    
    if (appliedDiscount) {
      if (appliedDiscount.discount_type === 'percentage') {
        finalAmount = finalAmount * (1 - appliedDiscount.discount_value / 100);
      } else {
        finalAmount = finalAmount - appliedDiscount.discount_value;
      }
    }
    
    return Math.max(0, finalAmount);
  }, [plan, appliedDiscount]);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      toast({
        variant: "destructive",
        title: t('validation.invalidEmail'),
      });
      return;
    }

    // Enumeration-safe: no server-side "does this email exist" probe.
    // Default to signup; returning users can switch to Sign in from the
    // signup step. Supabase Auth authoritatively rejects duplicates.
    logDebug('Email entered — advancing to signup', 'express-checkout');
    setStep('signup');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      logInfo('Attempting login from express checkout', 'express-checkout');
      const { error, data } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        logError('Login error', 'express-checkout', { error: error.message });
        toast({
          variant: "destructive",
          title: t('auth.loginFailed'),
          description: error.message,
        });
      } else {
        logInfo('User logged in successfully', 'express-checkout', undefined, data.user?.id);
        toast({
          title: t('auth.welcomeBack'),
        });
        setStep('payment');
      }
    } catch (error: any) {
      logError('Login exception', 'express-checkout', { error: error.message });
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

      logInfo('Attempting signup from express checkout', 'express-checkout');

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
        logError('Signup validation failed', 'express-checkout', { error: errorMsg });
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: errorMsg,
        });
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName || firstName,
            username,
          },
          emailRedirectTo: `${window.location.origin}/pricing`
        }
      });

      if (error) {
        logError('Signup error', 'express-checkout', { error: error.message });
        toast({
          variant: "destructive",
          title: t('auth.signupFailed'),
          description: error.message,
        });
      } else if (data?.user) {
        logInfo('User signed up successfully', 'express-checkout', undefined, data.user.id);
        toast({
          title: t('auth.accountCreated'),
        });
        setStep('payment');
      }
    } catch (error: any) {
      logError('Signup exception', 'express-checkout', { error: error.message });
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

  const handlePaymentSuccess = async (paymentData: any) => {
    logInfo('Payment successful from express checkout', 'express-checkout', paymentData);
    toast({
      title: "Payment Successful! 🎉",
      description: "Your subscription has been activated.",
    });
    onOpenChange(false);
    // Navigate to payment success or dashboard
    window.location.href = `/payment-success?planId=${plan?.id}&status=completed`;
  };

  const handlePaymentError = (error: any) => {
    logError('Payment error from express checkout', 'express-checkout', { error });
    toast({
      variant: "destructive",
      title: "Payment Failed",
      description: error?.message || "An error occurred during payment.",
    });
  };

  if (!plan) return null;

  const finalAmount = calculateFinalAmount();
  const features = Array.isArray(plan.features) ? plan.features : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg h-[90vh] flex flex-col p-0">
        {/* Custom Header with Badge */}
        <div className={cn("flex-shrink-0 p-6 border-b border-border", isRTL && "text-right")}>
          <span 
            className="inline-block rounded-lg text-white px-3 py-1 text-xs font-medium mb-3"
            style={{ backgroundColor: '#c49d68' }}
          >
            {t('checkout.checkout')}
          </span>
          <DialogHeader className={cn("p-0", isRTL ? "text-right" : "text-left")}>
            <DialogTitle className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
              {step === 'payment' ? t('checkout.completeYourPurchase') : t('checkout.getStarted')}
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Scrollable Content Area */}
        <ScrollArea className="flex-1 px-6">
          <div className="py-6 space-y-5">
            {/* Plan Summary */}
            <div className="bg-muted/50 rounded-lg p-4 border">
              <div className={cn("flex justify-between items-start mb-2", isRTL && "flex-row-reverse")}>
                <div className={isRTL ? "text-right" : ""}>
                  <h3 className="font-semibold text-lg">{plan.name}</h3>
                  {plan.is_lifetime && (
                    <span className="text-xs bg-warm-gold/10 text-warm-gold px-2 py-0.5 rounded">
                      {t('pricing.lifetimeAccess')}
                    </span>
                  )}
                </div>
                <div className={isRTL ? "text-left" : "text-right"}>
                  {appliedDiscount ? (
                    <>
                      <span className="text-sm text-muted-foreground line-through">${plan.price_usd}</span>
                      <span className="text-xl font-bold text-warm-gold ml-2">${finalAmount.toFixed(2)}</span>
                    </>
                  ) : (
                    <span className="text-xl font-bold text-warm-gold">${plan.price_usd}</span>
                  )}
                </div>
              </div>
              {features.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <ul className="space-y-1">
                    {features.slice(0, 3).map((feature: string, idx: number) => (
                      <li key={idx} className={cn("flex items-center gap-2 text-sm text-muted-foreground", isRTL && "flex-row-reverse")}>
                        <Check className="h-3 w-3 text-warm-gold flex-shrink-0" />
                        <span className="truncate">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Auth Steps */}
            {step !== 'payment' && (
              <>
                <GoogleAuthButton />
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      {t('auth.orContinueWith')}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Step 1: Email Input */}
            {step === 'email' && (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="express-email">{t('auth.email')}</Label>
                  <div className="relative">
                    <Mail className={cn("absolute top-3 h-4 w-4 text-muted-foreground", isRTL ? "right-3" : "left-3")} />
                    <Input
                      id="express-email"
                      type="email"
                      placeholder={t('auth.emailPlaceholder')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={cn("min-h-[44px]", isRTL ? "pr-10" : "pl-10")}
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full min-h-[44px]" disabled={isCheckingEmail || !email}>
                  {isCheckingEmail ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('common.loading')}</>
                  ) : (
                    <>{t('common.next')}<ArrowRight className={cn("h-4 w-4", isRTL ? "mr-2" : "ml-2")} /></>
                  )}
                </Button>
              </form>
            )}

            {/* Step 2a: Login */}
            {step === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="bg-blue-50 border border-blue-100 rounded-md p-3">
                  <p className={cn("text-sm text-blue-800", isRTL && "text-right")}>
                    {t('auth.welcomeBack')} <strong>{email}</strong>
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="express-password">{t('auth.password')}</Label>
                  <Input
                    id="express-password"
                    type="password"
                    placeholder={t('auth.passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="min-h-[44px]"
                    autoComplete="current-password"
                    autoFocus
                  />
                </div>

                <Button type="submit" className="w-full min-h-[44px]" disabled={isLoading || !password}>
                  {isLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('auth.signingIn')}</>
                  ) : (
                    t('auth.signIn')
                  )}
                </Button>

                <Button type="button" variant="ghost" className="w-full" onClick={handleBackToEmail}>
                  {t('auth.useAnotherEmail')}
                </Button>
              </form>
            )}

            {/* Step 2b: Signup */}
            {step === 'signup' && (
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="bg-green-50 border border-green-100 rounded-md p-3">
                  <p className={cn("text-sm text-green-800", isRTL && "text-right")}>
                    {t('auth.creatingAccountFor')} <strong>{email}</strong>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="express-fullName">{t('auth.fullName')}</Label>
                  <Input
                    id="express-fullName"
                    type="text"
                    placeholder={t('auth.fullNamePlaceholder')}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="min-h-[44px]"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="express-signupPassword">{t('auth.password')}</Label>
                  <Input
                    id="express-signupPassword"
                    type="password"
                    placeholder={t('auth.passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="min-h-[44px]"
                    autoComplete="new-password"
                  />
                  <PasswordStrengthIndicator password={password} />
                </div>

                <Button type="submit" className="w-full min-h-[44px]" disabled={isLoading || !fullName || !password}>
                  {isLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('auth.creatingAccount')}</>
                  ) : (
                    t('auth.createAccountAndContinue')
                  )}
                </Button>

                <Button type="button" variant="ghost" className="w-full" onClick={handleBackToEmail}>
                  {t('auth.useAnotherEmail')}
                </Button>
              </form>
            )}

            {/* Step 3: Payment */}
            {step === 'payment' && user && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-100 rounded-md p-3">
                  <p className={cn("text-sm text-green-800", isRTL && "text-right")}>
                    {t('auth.loggedInAs')} <strong>{user.email}</strong>
                  </p>
                </div>

                {/* Discount Code Input */}
                <DiscountCodeInput
                  onDiscountApplied={setAppliedDiscount}
                  onDiscountRemoved={() => setAppliedDiscount(null)}
                  appliedDiscount={appliedDiscount}
                  planId={plan.id}
                />

                {/* Final Amount Display */}
                {appliedDiscount && (
                  <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                    <div className={cn("flex justify-between items-center", isRTL && "flex-row-reverse")}>
                      <span className="text-sm text-green-800">{t('checkout.totalAfterDiscount')}</span>
                      <span className="text-lg font-bold text-green-800">${finalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* Payment Gateway Selection */}
                <SimplePaymentSelection
                  amount={finalAmount}
                  originalAmount={plan.price_usd}
                  planName={plan.name}
                  planId={plan.id}
                  userId={user.id}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                  appliedDiscount={appliedDiscount}
                />
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer with Trust Elements */}
        <div className="flex-shrink-0 p-6 border-t border-border space-y-4">
          <MoneyBackGuarantee variant="compact" />
          <EnhancedTrustBadges variant="compact" />
          <p className="text-xs text-muted-foreground text-center">
            {t('checkout.termsAgreement')}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
