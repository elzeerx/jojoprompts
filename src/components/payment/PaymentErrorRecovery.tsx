
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, CreditCard, HelpCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

interface PaymentErrorRecoveryProps {
  planId?: string;
  errorMessage?: string;
  paymentId?: string;
  onRetry?: () => void;
}

export function PaymentErrorRecovery({ 
  planId, 
  errorMessage, 
  paymentId, 
  onRetry 
}: PaymentErrorRecoveryProps) {
  const { user } = useAuth();
  const [retrying, setRetrying] = useState(false);

  const handleRetryPayment = async () => {
    if (!onRetry) return;
    
    try {
      setRetrying(true);
      await onRetry();
    } catch (error) {
      toast({
        title: "Retry Failed",
        description: "Unable to retry payment. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setRetrying(false);
    }
  };

  const getErrorSuggestion = (error?: string) => {
    if (!error) return "Please try your payment again or contact support if the issue persists.";
    
    const errorLower = error.toLowerCase();
    
    if (errorLower.includes('network') || errorLower.includes('timeout')) {
      return "This appears to be a network issue. Please check your connection and try again.";
    }
    
    if (errorLower.includes('card') || errorLower.includes('payment method')) {
      return "There was an issue with your payment method. Please check your card details or try a different payment method.";
    }
    
    if (errorLower.includes('insufficient') || errorLower.includes('declined')) {
      return "Your payment was declined. Please check your card balance or try a different payment method.";
    }
    
    if (errorLower.includes('expired')) {
      return "Your payment method has expired. Please update your payment information.";
    }
    
    return "Please try your payment again or contact support if the issue persists.";
  };

  return (
    <Card className="border-orange-200 bg-orange-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-800">
          <AlertTriangle className="h-5 w-5" />
          Payment Issue Detected
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800 font-medium">Error Details:</p>
            <p className="text-sm text-red-700 mt-1">{errorMessage}</p>
          </div>
        )}
        
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <HelpCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-800">Suggested Solution</p>
              <p className="text-sm text-blue-700 mt-1">
                {getErrorSuggestion(errorMessage)}
              </p>
            </div>
          </div>
        </div>

        {paymentId && (
          <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded border">
            <strong>Reference ID:</strong> {paymentId}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {onRetry && (
            <Button 
              onClick={handleRetryPayment}
              disabled={retrying}
              className="w-full"
            >
              {retrying ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Retrying Payment...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Retry Payment
                </>
              )}
            </Button>
          )}
          
          {planId && (
            <Button variant="outline" className="w-full" asChild>
              <Link to={`/checkout?plan_id=${planId}`}>
                Start New Payment
              </Link>
            </Button>
          )}
          
          <Button variant="ghost" className="w-full" asChild>
            <Link to="/contact">
              Contact Support
            </Link>
          </Button>
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>• No charges have been made to your account</p>
          <p>• Your subscription status remains unchanged</p>
          <p>• Support is available 24/7 to help resolve payment issues</p>
        </div>
      </CardContent>
    </Card>
  );
}
