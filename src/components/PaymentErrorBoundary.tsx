import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, CreditCard, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { safeLog } from '@/utils/safeLogging';

interface Props {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  paymentContext?: {
    planId?: string;
    orderId?: string;
    paymentId?: string;
  };
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

export class PaymentErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `payment_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log payment-specific error
    safeLog.error('Payment error boundary caught an error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId,
      paymentContext: this.props.paymentContext,
      location: window.location.href,
      timestamp: new Date().toISOString()
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    this.setState({
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    });
  };

  handleRetryPayment = () => {
    // Navigate back to checkout to retry payment
    const { planId } = this.props.paymentContext || {};
    if (planId) {
      window.location.href = `/checkout?planId=${planId}`;
    } else {
      window.location.href = '/pricing';
    }
  };

  handleContactSupport = () => {
    // Pre-fill contact form with payment context
    const { planId, orderId, paymentId } = this.props.paymentContext || {};
    const supportUrl = `/contact?context=payment&planId=${planId || ''}&orderId=${orderId || ''}&paymentId=${paymentId || ''}`;
    window.location.href = supportUrl;
  };

  render() {
    if (this.state.hasError) {
      return <PaymentErrorFallback 
        error={this.state.error}
        errorInfo={this.state.errorInfo}
        errorId={this.state.errorId}
        paymentContext={this.props.paymentContext}
        onReset={this.handleReset}
        onRetryPayment={this.handleRetryPayment}
        onContactSupport={this.handleContactSupport}
      />;
    }

    return this.props.children;
  }
}

interface PaymentErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  paymentContext?: {
    planId?: string;
    orderId?: string;
    paymentId?: string;
  };
  onReset: () => void;
  onRetryPayment: () => void;
  onContactSupport: () => void;
}

function PaymentErrorFallback({ 
  error, 
  errorInfo, 
  errorId, 
  paymentContext,
  onReset, 
  onRetryPayment, 
  onContactSupport 
}: PaymentErrorFallbackProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full shadow-xl border-orange-200">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
            <CreditCard className="h-8 w-8 text-orange-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-orange-800">
            Payment Processing Error
          </CardTitle>
          <CardDescription className="text-orange-600">
            We encountered an issue while processing your payment. Don't worry, your payment information is secure.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Payment Context Info */}
          {paymentContext && (
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <h4 className="font-semibold text-orange-800 mb-2">Payment Details:</h4>
              <div className="text-sm text-orange-700 space-y-1">
                {paymentContext.planId && <p>Plan ID: {paymentContext.planId}</p>}
                {paymentContext.orderId && <p>Order ID: {paymentContext.orderId}</p>}
                {paymentContext.paymentId && <p>Payment ID: {paymentContext.paymentId}</p>}
              </div>
            </div>
          )}

          {/* Error Details (only in development) */}
          {process.env.NODE_ENV === 'development' && error && (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <h4 className="font-semibold text-red-800 mb-2">Error Details:</h4>
              <p className="text-sm text-red-700 mb-2">{error.message}</p>
              {errorInfo && (
                <details className="text-xs text-red-600">
                  <summary className="cursor-pointer font-medium">Component Stack</summary>
                  <pre className="mt-2 whitespace-pre-wrap">{errorInfo.componentStack}</pre>
                </details>
              )}
              <p className="text-xs text-red-500 mt-2">Error ID: {errorId}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={onRetryPayment}
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Payment
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => navigate('/pricing')}
              className="flex-1"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Choose Different Plan
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => navigate(-1)}
              className="flex-1"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>

          {/* Contact Support */}
          <div className="text-center">
            <Button 
              variant="ghost" 
              onClick={onContactSupport}
              className="text-sm text-orange-600 hover:text-orange-700"
            >
              Contact Support
            </Button>
          </div>

          {/* Help Text */}
          <div className="text-center text-sm text-gray-600">
            <p>Your payment information is secure and has not been charged.</p>
            <p>If you continue to experience issues, please contact our support team.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 