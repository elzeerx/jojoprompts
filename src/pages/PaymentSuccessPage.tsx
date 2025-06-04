
import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { securityMonitor } from "@/utils/monitoring";
import { SecurityUtils } from "@/utils/security";

export default function PaymentSuccessPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  useEffect(() => {
    // Redirect to home if not authenticated
    if (!user) {
      securityMonitor.logEvent('access_denied', {
        page: 'payment_success',
        reason: 'not_authenticated'
      });
      navigate('/');
      return;
    }

    // Validate payment success parameters if present
    const paymentId = searchParams.get('payment_id');
    const sessionId = searchParams.get('session_id');
    
    if (paymentId && !SecurityUtils.isValidUUID(paymentId)) {
      securityMonitor.logEvent('suspicious_activity', {
        page: 'payment_success',
        reason: 'invalid_payment_id',
        paymentId
      }, user.id);
    }

    // Log successful payment page access
    console.log(`Payment success page accessed by user ${user.id}`);
    
  }, [user, navigate, searchParams]);
  
  // Don't render anything while checking authentication
  if (!user) {
    return null;
  }
  
  return (
    <div className="mobile-container-padding mobile-section-padding relative">
      {/* Enhanced mobile background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 right-10 text-warm-gold/20 animate-pulse">
          <Sparkles className="h-8 w-8" />
        </div>
        <div className="absolute bottom-10 left-10 text-muted-teal/20 animate-pulse delay-1000">
          <Sparkles className="h-6 w-6" />
        </div>
      </div>

      <div className="max-w-lg mx-auto relative z-10">
        <Card className="border-2 border-green-200 shadow-xl bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden">
          <CardHeader className="text-center pb-4 bg-gradient-to-r from-green-50 to-warm-gold/5">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <CheckCircle className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-green-500" />
                <div className="absolute -top-1 -right-1 text-warm-gold animate-bounce">
                  <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
              </div>
            </div>
            <CardTitle className="text-xl sm:text-2xl font-bold text-dark-base">Payment Successful!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4 sm:space-y-6 p-6">
            <p className="text-base sm:text-lg text-muted-foreground">
              Thank you for your purchase. Your plan access is now active.
            </p>
            
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 sm:p-6">
              <p className="font-medium text-green-800 text-sm sm:text-base">Your account has been successfully upgraded!</p>
              <p className="text-xs sm:text-sm mt-2 text-green-700">You now have access to all the features included in your plan.</p>
            </div>
            
            <div className="border-t pt-4 sm:pt-6">
              <p className="text-sm sm:text-base text-muted-foreground">
                We've sent you a confirmation email with your receipt and access details.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-3 p-6 pt-0">
            <Button className="w-full mobile-button-primary" asChild>
              <Link to="/prompts">Browse Prompts</Link>
            </Button>
            <Button variant="outline" className="w-full mobile-button-secondary" asChild>
              <Link to="/dashboard">View My Account</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
