
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function PaymentFailedPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  
  useEffect(() => {
    console.log('PaymentFailedPage accessed', {
      hasUser: !!user,
      userId: user?.id,
      searchParams: window.location.search,
      fullUrl: window.location.href
    });
    
  }, [user, searchParams]);

  const planId = searchParams.get('planId');
  const userId = searchParams.get('userId');
  const reason = searchParams.get('reason') || 'Payment was not completed';
  const tapId = searchParams.get('tap_id');
  const chargeStatus = searchParams.get('status');
  const responseCode = searchParams.get('response_code');
  
  // Log all parameters for debugging
  console.log('PaymentFailedPage parameters:', {
    planId,
    userId,
    reason,
    tapId,
    chargeStatus,
    responseCode
  });
  
  return (
    <div className="mobile-container-padding mobile-section-padding relative">
      <div className="max-w-lg mx-auto relative z-10">
        <Card className="border-2 border-red-200 shadow-xl bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden">
          <CardHeader className="text-center pb-4 bg-gradient-to-r from-red-50 to-red-100/5">
            <div className="flex justify-center mb-4">
              <XCircle className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-red-500" />
            </div>
            <CardTitle className="text-xl sm:text-2xl font-bold text-dark-base">Payment Failed</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4 sm:space-y-6 p-6">
            <p className="text-base sm:text-lg text-muted-foreground">
              Your payment could not be processed at this time.
            </p>
            
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-red-800 text-sm sm:text-base">Payment Error</p>
                  <p className="text-xs sm:text-sm mt-1 text-red-700">{reason}</p>
                  {chargeStatus && (
                    <p className="text-xs mt-1 text-red-600">Status: {chargeStatus}</p>
                  )}
                  {responseCode && (
                    <p className="text-xs mt-1 text-red-600">Code: {responseCode}</p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="border-t pt-4 sm:pt-6">
              <p className="text-sm sm:text-base text-muted-foreground">
                Don't worry - no charges were made to your account. You can try again or contact support if you continue to experience issues.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-3 p-6 pt-0">
            {planId && (
              <Button className="w-full mobile-button-primary" asChild>
                <Link to={`/checkout?plan_id=${planId}`}>Try Again</Link>
              </Button>
            )}
            <Button variant="outline" className="w-full mobile-button-secondary" asChild>
              <Link to="/pricing">View Plans</Link>
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
