import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, CheckCircle, Clock, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function EmailConfirmationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isResending, setIsResending] = useState(false);
  
  const email = searchParams.get('email');
  const firstName = searchParams.get('firstName');
  const plan = searchParams.get('plan');
  const fromCheckout = searchParams.get('fromCheckout');

  useEffect(() => {
    // If no email provided, redirect to signup
    if (!email) {
      navigate('/signup');
    }
  }, [email, navigate]);

  const handleResendConfirmation = async () => {
    if (!email || !firstName) return;
    
    setIsResending(true);
    try {
      const { error } = await supabase.functions.invoke('resend-confirmation-email', {
        body: { 
          email,
          firstName 
        }
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to resend confirmation email. Please try again.",
        });
      } else {
        toast({
          title: "Email sent! 📧",
          description: "We've sent another confirmation email to your inbox.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to resend confirmation email. Please try again.",
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleBackToSignup = () => {
    const params = new URLSearchParams();
    if (plan) params.append('plan', plan);
    if (fromCheckout) params.append('fromCheckout', fromCheckout);
    
    const queryString = params.toString();
    navigate(`/signup${queryString ? `?${queryString}` : ''}`);
  };

  if (!email) {
    return null;
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-9rem)] mobile-container-padding mobile-section-padding">
      <Card className="mx-auto max-w-md w-full border-2 border-warm-gold/20 rounded-2xl shadow-xl bg-white/95 backdrop-blur-sm">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Mail className="h-16 w-16 text-warm-gold" />
              <div className="absolute -top-1 -right-1 bg-warm-gold rounded-full p-1">
                <Clock className="h-4 w-4 text-white" />
              </div>
            </div>
          </div>
          <CardTitle className="text-xl sm:text-2xl font-bold text-dark-base">
            Check Your Email
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6 px-4 sm:px-6 pb-6">
          <div className="text-center space-y-4">
            <div className="bg-warm-gold/10 rounded-lg p-4 border border-warm-gold/20">
              <p className="text-sm sm:text-base text-dark-base/80 leading-relaxed">
                We've sent a confirmation email to:
              </p>
              <p className="font-semibold text-warm-gold text-sm sm:text-base mt-2 break-all">
                {email}
              </p>
            </div>

            <div className="text-left space-y-3 text-sm text-dark-base/70">
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-4 w-4 text-warm-gold mt-0.5 flex-shrink-0" />
                <span>Click the confirmation link in your email</span>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-4 w-4 text-warm-gold mt-0.5 flex-shrink-0" />
                <span>Check your spam/junk folder if you don't see it</span>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-4 w-4 text-warm-gold mt-0.5 flex-shrink-0" />
                <span>The link will redirect you back to complete your registration</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4">
            <Button
              onClick={handleResendConfirmation}
              disabled={isResending}
              variant="outline"
              className="w-full border-warm-gold text-warm-gold hover:bg-warm-gold hover:text-white"
            >
              {isResending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Resend Email
                </>
              )}
            </Button>

            <Button
              onClick={handleBackToSignup}
              variant="ghost"
              className="w-full text-muted-foreground hover:text-dark-base"
            >
              Back to Sign Up
            </Button>
          </div>

          <div className="text-center pt-4 border-t border-warm-gold/10">
            <p className="text-xs text-muted-foreground">
              Need help? Contact our support team
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}