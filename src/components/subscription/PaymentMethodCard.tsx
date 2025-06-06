
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaymentMethodCardProps {
  title: string;
  description: string;
  badge?: string;
  error?: string;
  retryCount: number;
  maxRetries: number;
  isProcessing: boolean;
  isBlocked: boolean;
  onRetry: () => void;
  children: React.ReactNode;
}

export function PaymentMethodCard({
  title,
  description,
  badge,
  error,
  retryCount,
  maxRetries,
  isProcessing,
  isBlocked,
  onRetry,
  children
}: PaymentMethodCardProps) {
  return (
    <Card className="relative">
      <CardContent className="p-6">
        <div className="mb-4">
          <h4 className="font-medium flex items-center gap-2">
            <span>{title}</span>
            {badge && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                {badge}
              </span>
            )}
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            {description}
          </p>
        </div>
        
        {isBlocked && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Another payment method is processing...
              </AlertDescription>
            </Alert>
          </div>
        )}

        {error && (
          <Alert className="mb-4 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {error}
              {retryCount < maxRetries && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={onRetry}
                  className="ml-2 h-6 text-xs"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry ({retryCount + 1}/{maxRetries})
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
        
        {children}
      </CardContent>
    </Card>
  );
}
