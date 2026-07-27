import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { AppleEmailNotice } from "@/components/auth/AppleEmailNotice";
import { resolveSafeNext } from "@/lib/v2/safeNext";
import { createLogger } from '@/utils/logging';

const logger = createLogger('MAGIC_LINK_SENT_PAGE');

export default function MagicLinkSentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isResending, setIsResending] = useState(false);

  const email = searchParams.get('email');
  // V2: safe same-origin destination only — legacy plan/fromCheckout ignored.
  const safeNextPath = resolveSafeNext(searchParams.get('next'));

  if (!email) {
    navigate('/signup');
    return null;
  }

  const handleResendMagicLink = async () => {
    setIsResending(true);
    try {
      const emailRedirectTo = `${window.location.origin}${safeNextPath}`;

      // Uses Supabase Auth's built-in OTP magic link. No custom
      // service-role helper, no account enumeration.
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo, shouldCreateUser: true },
      });

      if (error) {
        logger.warn('Auth signInWithOtp returned an error (surfaced generically)', {
          code: (error as { status?: number }).status,
        });
      }

      toast({
        title: "Magic link sent ✨",
        description: "If your email is valid, a new secure login link is on its way. Check spam if you don't see it.",
      });
    } catch (error) {
      logger.error('Magic link resend error', { error: (error as Error).message });
      // Generic success copy — no infra leak.
      toast({
        title: "Magic link sent ✨",
        description: "If your email is valid, a new secure login link is on its way. Check spam if you don't see it.",
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleBackToSignup = () => {
    navigate('/signup');
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-9rem)] mobile-container-padding mobile-section-padding">
      <Card className="mx-auto max-w-md w-full border-2 border-warm-gold/20 rounded-2xl shadow-xl bg-white/95 backdrop-blur-sm">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-green-100 p-4">
              <Mail className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-xl text-center mb-2">Magic Link Sent! ✨</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 px-4 sm:px-6">
          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              We've sent a secure login link to:
            </p>
            <p className="font-medium text-warm-gold break-all">{email}</p>
            <p className="text-sm text-muted-foreground">
              Click the link in your email to sign in instantly - no password required!
            </p>
          </div>

          <AppleEmailNotice email={email} />

          <div className="space-y-3">
            <Button
              onClick={handleResendMagicLink}
              disabled={isResending}
              variant="outline"
              className="w-full min-h-[44px]"
            >
              {isResending ? "Sending..." : "Resend Magic Link"}
            </Button>

            <Button
              onClick={handleBackToSignup}
              variant="ghost"
              className="w-full min-h-[44px]"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Signup
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center space-y-1">
            <p>• Magic links expire after 1 hour</p>
            <p>• Check your spam folder if you don't see the email</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
