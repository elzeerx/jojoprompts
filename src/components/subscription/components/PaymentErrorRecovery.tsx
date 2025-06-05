
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Wifi, WifiOff } from "lucide-react";

interface PaymentErrorRecoveryProps {
  paypalError: string | null;
  tapError: string | null;
  onRetryPayPal: () => void;
  onRetryTap: () => void;
  onRunDiagnostics: () => void;
  isTestingConnectivity: boolean;
  connectivityStatus: {
    paypal: boolean | null;
    tap: boolean | null;
    lastChecked: Date | null;
  };
}

export function PaymentErrorRecovery({
  paypalError,
  tapError,
  onRetryPayPal,
  onRetryTap,
  onRunDiagnostics,
  isTestingConnectivity,
  connectivityStatus
}: PaymentErrorRecoveryProps) {
  const hasAnyError = paypalError || tapError;
  
  if (!hasAnyError) return null;

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-orange-800 mb-2">Payment Methods Unavailable</h4>
            
            {paypalError && (
              <div className="mb-3 p-2 bg-white rounded border border-orange-200">
                <div className="flex items-center gap-2 mb-1">
                  {connectivityStatus.paypal === false ? (
                    <WifiOff className="h-4 w-4 text-red-500" />
                  ) : (
                    <Wifi className="h-4 w-4 text-gray-500" />
                  )}
                  <span className="text-sm font-medium">PayPal</span>
                </div>
                <p className="text-xs text-gray-600 mb-2">{paypalError}</p>
                <Button size="sm" variant="outline" onClick={onRetryPayPal}>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry PayPal
                </Button>
              </div>
            )}

            {tapError && (
              <div className="mb-3 p-2 bg-white rounded border border-orange-200">
                <div className="flex items-center gap-2 mb-1">
                  {connectivityStatus.tap === false ? (
                    <WifiOff className="h-4 w-4 text-red-500" />
                  ) : (
                    <Wifi className="h-4 w-4 text-gray-500" />
                  )}
                  <span className="text-sm font-medium">Tap Payment</span>
                </div>
                <p className="text-xs text-gray-600 mb-2">{tapError}</p>
                <Button size="sm" variant="outline" onClick={onRetryTap}>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry Tap Payment
                </Button>
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-orange-200">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={onRunDiagnostics}
                disabled={isTestingConnectivity}
                className="w-full"
              >
                {isTestingConnectivity ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                    Testing Connection...
                  </>
                ) : (
                  <>
                    <Wifi className="h-3 w-3 mr-2" />
                    Test Payment Services
                  </>
                )}
              </Button>
              
              {connectivityStatus.lastChecked && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Last checked: {connectivityStatus.lastChecked.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
