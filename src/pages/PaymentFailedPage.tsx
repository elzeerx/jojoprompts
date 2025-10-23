import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { createLogger } from '@/utils/logging';

const logger = createLogger('PAYMENT_FAILED_PAGE');

export default function PaymentFailedPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  
  useEffect(() => {
    logger.info('PaymentFailedPage accessed', {
      hasUser: !!user,
      userId: user?.id,
      searchParams: window.location.search
    });
  }, [user, searchParams]);

  const planId = searchParams.get('planId');
  const userId = searchParams.get('userId');
  const reason = searchParams.get('reason') || 'Payment was not completed';
  
  // Enhanced error categorization for better user experience
  const getErrorDetails = () => {
    const lowerReason = reason.toLowerCase();
    
    if (lowerReason.includes('declined')) {
      return {
        title: "Card Declined",
        message: "Your payment method was declined by your bank.",
        suggestions: [
          "Check your card details and try again",
          "Contact your bank to ensure the card is active",
          "Try a different card or PayPal account"
        ]
      };
    }
    
    if (lowerReason.includes('insufficient')) {
      return {
        title: "Insufficient Funds",
        message: "Your payment method has insufficient funds.",
        suggestions: [
          "Check your account balance",
          "Try a different card or PayPal account",
          "Contact your bank for assistance"
        ]
      };
    }
    
    if (lowerReason.includes('expired')) {
      return {
        title: "Card Expired",
        message: "Your payment method has expired.",
        suggestions: [
          "Update your card or PayPal account",
          "Use a different payment method",
          "Contact your bank for a new card"
        ]
      };
    }
    
    if (lowerReason.includes('cancelled') || lowerReason.includes('abandoned')) {
      return {
        title: "Payment Cancelled",
        message: "The payment was cancelled or abandoned.",
        suggestions: [
          "Try the payment process again",
          "Ensure you complete all payment steps",
          "Contact support if you continue to experience issues"
        ]
      };
    }
    
    if (lowerReason.includes('network') || lowerReason.includes('timeout')) {
      return {
        title: "Connection Issue",
        message: "There was a network or connection problem.",
        suggestions: [
          "Check your internet connection",
          "Try again in a few moments",
          "Use a different network if possible"
        ]
      };
    }
    
    // Default case
    return {
      title: "Payment Failed",
      message: reason,
      suggestions: [
        "Try the payment process again",
        "Check your payment method details",
        "Contact support if the issue persists"
      ]
    };
  };

  const errorDetails = getErrorDetails();
  
  logger.debug('Payment failure details', { planId, userId, reason, errorType: errorDetails.title });
  
  return (
    <div className="mobile-container-padding mobile-section-padding relative">
      <div className="max-w-lg mx-auto relative z-10">
        <Card className="border-2 border-red-200 shadow-xl bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden">
          <CardHeader className="text-center pb-4 bg-gradient-to-r from-red-50 to-red-100/5">
            <div className="flex justify-center mb-4">
              <XCircle className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-red-500" />
            </div>
            <CardTitle className="text-xl sm:text-2xl font-bold text-dark-base">{errorDetails.title}</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4 sm:space-y-6 p-6">
            <p className="text-base sm:text-lg text-muted-foreground">
              {errorDetails.message}
            </p>
            
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <p className="font-medium text-red-800 text-sm sm:text-base mb-2">What you can do:</p>
                  <ul className="text-xs sm:text-sm text-red-700 space-y-1">
                    {errorDetails.suggestions.map((suggestion, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-red-500 mt-1">•</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="border-t pt-4 sm:pt-6">
              <p className="text-sm sm:text-base text-muted-foreground">
                Don't worry - no charges were made to your account. Your payment information is secure.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-3 p-6 pt-0">
            {planId && (
              <Button className="w-full mobile-button-primary" asChild>
                <Link to={`/checkout?plan_id=${planId}`}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Payment Again
                </Link>
              </Button>
            )}
            <Button variant="outline" className="w-full mobile-button-secondary" asChild>
              <Link to="/pricing">View All Plans</Link>
            </Button>
            <Button variant="ghost" className="w-full" asChild>
              <Link to="/contact">Contact Support</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
