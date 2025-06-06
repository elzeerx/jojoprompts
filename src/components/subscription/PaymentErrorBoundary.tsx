
import React, { Component, ErrorInfo, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PaymentErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Payment component error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Payment System Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              There was an unexpected error with the payment system. This might be due to:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
              <li>• Network connectivity issues</li>
              <li>• Payment gateway maintenance</li>
              <li>• Browser compatibility issues</li>
            </ul>
            <div className="flex flex-col gap-2">
              <Button onClick={this.handleRetry} className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
                className="text-sm"
              >
                Refresh Page
              </Button>
            </div>
            {this.state.error && (
              <details className="text-xs text-gray-500 mt-4">
                <summary className="cursor-pointer">Technical Details</summary>
                <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
