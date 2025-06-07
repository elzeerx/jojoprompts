import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function PaymentSuccessPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [processing, setProcessing] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    console.log('PaymentSuccessPage accessed', {
      hasUser: !!user,
      userId: user?.id,
      searchParams: window.location.search,
      fullUrl: window.location.href
    });

    const validateSubscription = async () => {
      try {
        // Extract parameters from URL
        const planId = searchParams.get('planId');
        const userId = searchParams.get('userId');
        const tapId = searchParams.get('tap_id');
        
        console.log('PaymentSuccessPage: Validating subscription with params:', { 
          planId, 
          userId, 
          tapId
        });

        // Check for required parameters
        if (!planId || !userId || !tapId) {
          console.error('PaymentSuccessPage: Missing required parameters');
          throw new Error('Missing payment information');
        }

        // Verify user ID matches authenticated user (if user is logged in)
        if (user && userId !== user.id) {
          console.error('PaymentSuccessPage: User ID mismatch');
          throw new Error('Invalid payment session');
        }

        // Check if subscription exists in our new subscriptions table
        const { data: subscription, error: subError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('provider_tx_id', tapId)
          .eq('user_id', userId)
          .single();

        if (subError || !subscription) {
          console.error('PaymentSuccessPage: Subscription not found:', subError);
          throw new Error('Subscription not found - please contact support');
        }

        console.log('PaymentSuccessPage: Subscription found:', subscription);

        // Success! 
        setSuccess(true);
        setProcessing(false);

        console.log('PaymentSuccessPage: Subscription validation completed successfully');

        toast({
          title: "Payment Successful!",
          description: "Your subscription has been activated successfully.",
        });

      } catch (error: any) {
        console.error('PaymentSuccessPage: Validation error:', error);
        
        const errorMessage = error.message || 'Subscription validation failed';
        
        console.log('PaymentSuccessPage: Setting error state:', errorMessage);
        
        setError(errorMessage);
        setProcessing(false);
      }
    };

    validateSubscription();
    
  }, [user, navigate, searchParams]);

  if (processing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-soft-bg">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium">Validating your subscription...</p>
          <p className="text-sm text-gray-500 mt-2">Please wait while we confirm your access...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-soft-bg">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Subscription Validation Failed</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="space-y-2">
            <Button className="w-full" asChild>
              <Link to="/pricing">Back to Pricing</Link>
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <Link to="/contact">Contact Support</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-soft-bg">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Subscription Not Found</h2>
          <p className="text-gray-600 mb-4">We couldn't find your subscription.</p>
          <div className="space-y-2">
            <Button className="w-full" asChild>
              <Link to="/pricing">Back to Pricing</Link>
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <Link to="/contact">Contact Support</Link>
            </Button>
          </div>
        </div>
      </div>
    );
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
                You can now start using all the features included in your subscription plan.
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
