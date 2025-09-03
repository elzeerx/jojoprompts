import React, { useState, useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface PreviewWatchdogProps {
  children: React.ReactNode;
}

export function PreviewWatchdog({ children }: PreviewWatchdogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    // Give the preview 3 seconds to load
    const timer = setTimeout(() => {
      setIsLoading(false);
      setShowFallback(true);
    }, 3000);

    // Check if content appears (basic heuristic)
    const checkForContent = setInterval(() => {
      const mainContent = document.querySelector('main');
      if (mainContent && mainContent.children.length > 0) {
        setIsLoading(false);
        setShowFallback(false);
        clearInterval(checkForContent);
        clearTimeout(timer);
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      clearInterval(checkForContent);
    };
  }, []);

  const handleRetry = () => {
    window.location.reload();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-soft-bg">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-warm-gold border-t-transparent"></div>
          <p className="text-dark-base/60">Loading preview...</p>
        </div>
      </div>
    );
  }

  if (showFallback && !hasError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-soft-bg p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-amber-500" />
            <h3 className="text-lg font-semibold text-dark-base">
              Preview Taking Longer Than Expected
            </h3>
            <p className="text-dark-base/60 text-sm">
              The application preview might be loading slowly. You can wait or try refreshing.
            </p>
            <Button 
              onClick={handleRetry}
              className="bg-warm-gold hover:bg-warm-gold/90 text-white"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Preview
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}