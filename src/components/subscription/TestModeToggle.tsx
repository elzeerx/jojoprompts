
import React from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface TestModeToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function TestModeToggle({ enabled, onToggle }: TestModeToggleProps) {
  return (
    <div className="space-y-4">
      {enabled && (
        <Alert className="bg-yellow-50 border-yellow-200">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            Test mode is enabled. No real payments will be processed.
          </AlertDescription>
        </Alert>
      )}
      
      <div className="flex items-center space-x-2">
        <Switch
          id="test-mode"
          checked={enabled}
          onCheckedChange={onToggle}
        />
        <Label htmlFor="test-mode" className={`font-medium ${enabled ? 'text-yellow-700' : ''}`}>
          Enable Test Mode
        </Label>
      </div>
      
      {enabled && (
        <p className="text-sm text-muted-foreground">
          When test mode is enabled, payments are simulated and no actual charges will be made.
          This is useful for testing the checkout flow in preview environments.
        </p>
      )}
    </div>
  );
}
