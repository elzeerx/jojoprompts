
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PaymentFallback() {
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <Card className="border-red-200">
      <CardContent className="p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="mb-4">
            Both payment methods are currently unavailable. This might be due to:
          </AlertDescription>
        </Alert>
        <ul className="text-sm text-muted-foreground mb-4 ml-4 space-y-1">
          <li>• Network connectivity issues</li>
          <li>• Temporary service maintenance</li>
          <li>• Browser compatibility issues</li>
        </ul>
        <div className="flex flex-col gap-2">
          <Button 
            onClick={handleRefresh} 
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Page
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            If the issue persists, please contact support
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
