
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle, Sparkles, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PaymentSuccessCardProps {
  gateway?: 'paypal' | 'upayments' | string;
}

export function PaymentSuccessCard({ gateway = 'paypal' }: PaymentSuccessCardProps) {
  const isUpayments = gateway === 'upayments';
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);
  
  // Auto-redirect to browse prompts after 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/prompts');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [navigate]);
  
  return (
    <div className="mobile-container-padding mobile-section-padding relative">
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
            <Badge 
              variant="outline" 
              className={`mt-2 ${isUpayments 
                ? 'border-emerald-500/30 text-emerald-700 bg-emerald-50' 
                : 'border-blue-500/30 text-blue-700 bg-blue-50'}`}
            >
              <CreditCard className="h-3 w-3 mr-1" />
              Paid via {isUpayments ? 'Local Payment (KWD)' : 'PayPal (USD)'}
            </Badge>
          </CardHeader>
          <CardContent className="text-center space-y-4 sm:space-y-6 p-6">
            <p className="text-base sm:text-lg text-muted-foreground">
              Thank you for your purchase. Your plan access is now active.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 sm:p-6">
              <p className="font-medium text-green-800 text-sm sm:text-base">Your account has been successfully upgraded!</p>
              <p className="text-xs sm:text-sm mt-2 text-green-700">You now have access to all the features included in your plan.</p>
            </div>
            <div className="border-t pt-4 sm:pt-6 space-y-2">
              <p className="text-sm sm:text-base text-muted-foreground">
                We've sent you a confirmation email with your receipt and access details.
              </p>
              <p className="text-xs sm:text-sm text-green-600 flex items-center justify-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5" />
                Your email has been automatically verified
              </p>
            </div>
            {/* Auto-redirect countdown */}
            <div className="bg-warm-gold/10 border border-warm-gold/20 rounded-lg p-3">
              <p className="text-sm text-warm-gold font-medium">
                Redirecting to browse prompts in {countdown} second{countdown !== 1 ? 's' : ''}...
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-3 p-6 pt-0">
            <Button className="w-full mobile-button-primary" asChild>
              <Link to="/prompts">Browse Prompts Now</Link>
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
