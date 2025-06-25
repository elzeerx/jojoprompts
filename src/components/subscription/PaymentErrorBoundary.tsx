
import React, { Component, ErrorInfo, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, ExternalLink } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

export class PaymentErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Payment component error:', error, errorInfo);
    
    // Log additional context for debugging
    console.error('Payment Error Details:', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    });
  }

  handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState(prevState => ({ 
        hasError: false, 
        error: null,
        retryCount: prevState.retryCount + 1
      }));
    }
  };

  handleRefresh = () => {
    window.location.reload();
  };

  getErrorCategory = (error: Error): string => {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'network';
    }
    if (message.includes('script') || message.includes('load')) {
      return 'loading';
    }
    if (message.includes('paypal') || message.includes('tap')) {
      return 'payment_gateway';
    }
    if (message.includes('timeout')) {
      return 'timeout';
    }
    return 'unknown';
  };

  getErrorSuggestions = (category: string): string[] => {
    switch (category) {
      case 'network':
        return [
          'Check your internet connection',
          'Disable VPN if you\'re using one',
          'Try switching to a different network'
        ];
      case 'loading':
        return [
          'Refresh the page to reload payment systems',
          'Disable ad blockers or browser extensions',
          'Clear your browser cache and cookies'
        ];
      case 'payment_gateway':
        return [
          'Try the alternative payment method',
          'Ensure cookies and JavaScript are enabled',
          'Contact your bank if using a credit card'
        ];
      case 'timeout':
        return [
          'Check your internet connection speed',
          'Try again in a few moments',
          'Refresh the page and retry'
        ];
      default:
        return [
          'Refresh the page and try again',
          'Clear your browser cache',
          'Try using a different browser'
        ];
    }
  };

  render() {
    if (this.state.hasError) {
      const errorCategory = this.getErrorCategory(this.state.error!);
      const suggestions = this.getErrorSuggestions(errorCategory);
      const canRetry = this.state.retryCount < this.maxRetries;

      return (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Payment System Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-red-50 rounded-lg">
              <p className="text-sm text-red-800 font-medium mb-2">
                Something went wrong with the payment system
              </p>
              <p className="text-sm text-red-700">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Suggested solutions:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              {canRetry && (
                <Button 
                  onClick={this.handleRetry} 
                  className="flex items-center gap-2"
                  variant="default"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again ({this.state.retryCount + 1}/{this.maxRetries})
                </Button>
              )}
              
              <Button 
                variant={canRetry ? "outline" : "default"} 
                onClick={this.handleRefresh}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh Page
              </Button>

              {!canRetry && (
                <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700 font-medium mb-1">
                    Still having issues?
                  </p>
                  <p className="text-xs text-gray-600 mb-2">
                    This error has occurred multiple times. Please contact our support team for assistance.
                  </p>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => window.open('mailto:support@example.com', '_blank')}
                    className="flex items-center gap-1 text-xs"
                  >
                    Contact Support
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="text-xs text-gray-500 mt-4">
                <summary className="cursor-pointer font-medium">
                  Technical Details (Development)
                </summary>
                <div className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                  <div className="mb-2">
                    <strong>Error:</strong> {this.state.error.message}
                  </div>
                  <div className="mb-2">
                    <strong>Category:</strong> {errorCategory}
                  </div>
                  {this.state.error.stack && (
                    <div>
                      <strong>Stack Trace:</strong>
                      <pre className="whitespace-pre-wrap text-xs">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
