import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function MagicLinkSentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isResending, setIsResending] = useState(false);

  const email = searchParams.get('email');
  const firstName = searchParams.get('firstName');
  const selectedPlan = searchParams.get('plan');
  const fromCheckout = searchParams.get('fromCheckout') === 'true';

  if (!email) {
    navigate('/signup');
    return null;
  }

  const handleResendMagicLink = async () => {
    setIsResending(true);

    try {
      let redirectUrl = `${window.location.origin}/prompts`;
      
      if (selectedPlan) {
        redirectUrl = `${window.location.origin}/checkout?plan_id=${selectedPlan}`;
      } else if (fromCheckout) {
        redirectUrl = `${window.location.origin}/checkout`;
      }

      const { data, error } = await supabase.functions.invoke('send-signup-confirmation', {
        body: {
          email: email,
          firstName: firstName || 'User',
          lastName: '',
          userId: crypto.randomUUID(), // Generate temporary ID
          redirectUrl: redirectUrl
        }
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "Failed to resend magic link. Please try again.",
        });
      } else if (!data?.success) {
        toast({
          variant: "destructive",
          title: "Error",
          description: data?.error || "Failed to resend magic link. Please try again.",
        });
      } else {
        toast({
          title: "Magic link sent! ✨",
          description: "Check your email for a new secure login link.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to resend magic link. Please try again.",
      });
    }

    setIsResending(false);
  };

  const handleBackToSignup = () => {
    const params = selectedPlan ? `?plan=${selectedPlan}` : "";
    navigate(`/signup${params}`);
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

          <div className="space-y-3">
            <Button
              onClick={handleResendMagicLink}
              disabled={isResending}
              variant="outline"
              className="w-full"
            >
              {isResending ? "Sending..." : "Resend Magic Link"}
            </Button>
            
            <Button
              onClick={handleBackToSignup}
              variant="ghost"
              className="w-full"
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