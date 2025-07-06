import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  private handleGoHome = () => {
    // Force navigation without using React Router
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-soft-bg">
          <div className="max-w-md mx-auto text-center p-6">
            <h1 className="text-2xl font-bold text-dark-base mb-4">
              Something went wrong
            </h1>
            <p className="text-muted-foreground mb-6">
              The application encountered an error. Please try again or return home.
            </p>
            <div className="space-y-3">
              <Button 
                onClick={this.handleRetry}
                className="w-full"
              >
                Try Again
              </Button>
              <Button 
                variant="outline"
                onClick={this.handleGoHome}
                className="w-full"
              >
                Return Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}