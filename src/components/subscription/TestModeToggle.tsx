
import React from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface TestModeToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  prominent?: boolean;
}

export function TestModeToggle({ enabled, onToggle, prominent = false }: TestModeToggleProps) {
  return (
    <div className={`space-y-4 ${prominent ? 'bg-amber-50 p-4 border border-amber-200 rounded-lg' : ''}`}>
      {enabled && (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 font-medium">
            Test mode is active. No real payments will be processed.
          </AlertDescription>
        </Alert>
      )}
      
      <div className="flex items-center space-x-2">
        <Switch
          id="test-mode"
          checked={enabled}
          onCheckedChange={onToggle}
          className={enabled ? "bg-amber-500" : ""}
        />
        <Label htmlFor="test-mode" className={`font-medium ${enabled ? 'text-amber-700' : ''}`}>
          Enable Test Mode
        </Label>
      </div>
      
      {enabled && (
        <p className="text-sm text-muted-foreground">
          When test mode is enabled, all payments are simulated and no actual charges will be made.
          This is useful for testing the checkout flow in preview environments.
        </p>
      )}

      {!enabled && prominent && (
        <p className="text-sm text-amber-600 font-medium">
          You're in a preview environment. It's recommended to enable Test Mode for payment testing.
        </p>
      )}
    </div>
  );
}
