import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  RefreshCw, 
  CreditCard, 
  Mail, 
  Phone, 
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  Info
} from 'lucide-react';

interface EnhancedErrorMessageProps {
  error: string;
  errorType?: 'payment_failed' | 'session_lost' | 'network_error' | 'validation_error' | 'server_error';
  context?: {
    transactionId?: string;
    orderId?: string;
    paymentId?: string;
    planId?: string;
    amount?: number;
  };
  onRetry?: () => void;
  onContactSupport?: () => void;
}

const getErrorTypeInfo = (errorType: string) => {
  switch (errorType) {
    case 'payment_failed':
      return {
        icon: <XCircle className="h-5 w-5 text-red-600" />,
        title: 'Payment Failed',
        color: 'border-red-200 bg-red-50',
        suggestions: [
          'Check that your payment method has sufficient funds',
          'Verify your billing information is correct',
          'Try using a different payment method',
          'Contact your bank if the issue persists'
        ]
      };
    case 'session_lost':
      return {
        icon: <AlertTriangle className="h-5 w-5 text-yellow-600" />,
        title: 'Session Expired',
        color: 'border-yellow-200 bg-yellow-50',
        suggestions: [
          'Your session expired during payment processing',
          'Your payment may have been successful - check your email',
          'Try refreshing the page to restore your session',
          'Log in again to access your account'
        ]
      };
    case 'network_error':
      return {
        icon: <RefreshCw className="h-5 w-5 text-blue-600" />,
        title: 'Connection Issue',
        color: 'border-blue-200 bg-blue-50',
        suggestions: [
          'Check your internet connection',
          'Try refreshing the page',
          'Disable VPN if you\'re using one',
          'Try again in a few minutes'
        ]
      };
    case 'validation_error':
      return {
        icon: <Info className="h-5 w-5 text-orange-600" />,
        title: 'Invalid Information',
        color: 'border-orange-200 bg-orange-50',
        suggestions: [
          'Check that all required fields are filled correctly',
          'Verify your email address format',
          'Ensure payment information matches your billing address',
          'Try using a different browser'
        ]
      };
    case 'server_error':
      return {
        icon: <AlertTriangle className="h-5 w-5 text-red-600" />,
        title: 'Service Temporarily Unavailable',
        color: 'border-red-200 bg-red-50',
        suggestions: [
          'Our servers are experiencing issues',
          'Please try again in a few minutes',
          'Your payment data is safe and secure',
          'Contact support if the issue continues'
        ]
      };
    default:
      return {
        icon: <AlertTriangle className="h-5 w-5 text-gray-600" />,
        title: 'Something Went Wrong',
        color: 'border-gray-200 bg-gray-50',
        suggestions: [
          'An unexpected error occurred',
          'Try refreshing the page',
          'Clear your browser cache',
          'Contact our support team for assistance'
        ]
      };
  }
};

export function EnhancedErrorMessage({ 
  error, 
  errorType = 'server_error', 
  context, 
  onRetry, 
  onContactSupport 
}: EnhancedErrorMessageProps) {
  const errorInfo = getErrorTypeInfo(errorType);

  const handleContactSupport = () => {
    if (onContactSupport) {
      onContactSupport();
    } else {
      // Default behavior - open contact form
      window.open('/contact', '_blank');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Main Error Card */}
      <Card className={`border-2 ${errorInfo.color}`}>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3">
            {errorInfo.icon}
            <span>{errorInfo.title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Error Description */}
          <Alert className="border-0 bg-transparent p-0">
            <AlertDescription className="text-base">
              {error}
            </AlertDescription>
          </Alert>

          {/* Context Information */}
          {context && (
            <div className="bg-white/50 rounded-lg p-4 space-y-2">
              <h4 className="font-semibold text-sm text-gray-700 mb-2">Transaction Details:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {context.transactionId && (
                  <div>
                    <span className="text-gray-600">Transaction ID:</span>
                    <span className="font-mono ml-2">{context.transactionId.substring(0, 8)}...</span>
                  </div>
                )}
                {context.orderId && (
                  <div>
                    <span className="text-gray-600">Order ID:</span>
                    <span className="font-mono ml-2">{context.orderId.substring(0, 8)}...</span>
                  </div>
                )}
                {context.amount && (
                  <div>
                    <span className="text-gray-600">Amount:</span>
                    <span className="font-semibold ml-2">${context.amount.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            {onRetry && (
              <Button onClick={onRetry} className="flex-1 min-w-[140px]">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={handleContactSupport}
              className="flex-1 min-w-[140px]"
            >
              <Mail className="h-4 w-4 mr-2" />
              Contact Support
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Troubleshooting Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">What you can try:</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {errorInfo.suggestions.map((suggestion, index) => (
              <li key={index} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-sm font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {index + 1}
                </div>
                <span className="text-gray-700">{suggestion}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Need More Help?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button variant="outline" asChild className="justify-start">
              <a href="/payment-dashboard">
                <CreditCard className="h-4 w-4 mr-2" />
                View Payment History
              </a>
            </Button>
            <Button variant="outline" asChild className="justify-start">
              <a href="/faq">
                <Info className="h-4 w-4 mr-2" />
                Check FAQ
              </a>
            </Button>
          </div>
          
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-sm text-gray-800 mb-2">Contact Information</h4>
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Mail className="h-3 w-3" />
                <span>support@jojoprompts.com</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                <span>Response time: Usually within 24 hours</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Note */}
      <div className="text-center">
        <p className="text-xs text-gray-500 flex items-center justify-center gap-2">
          <CheckCircle2 className="h-3 w-3" />
          Your payment information is always secure and encrypted
        </p>
      </div>
    </div>
  );
}