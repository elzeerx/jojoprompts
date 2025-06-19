
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import { AlertTriangle } from "lucide-react";

interface DangerZoneProps {
  hasActiveSubscription?: boolean;
  subscriptionPlan?: string;
}

export function DangerZone({ hasActiveSubscription, subscriptionPlan }: DangerZoneProps) {
  return (
    <Card className="border-red-200 bg-red-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-600">
          <AlertTriangle className="h-5 w-5" />
          Danger Zone
        </CardTitle>
        <CardDescription>
          Irreversible and destructive actions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Delete Account</h4>
          <p className="text-sm text-muted-foreground">
            Permanently delete your account and all associated data. This action cannot be undone.
            {hasActiveSubscription && " Your active subscription will be cancelled."}
          </p>
        </div>
        <DeleteAccountDialog 
          hasActiveSubscription={hasActiveSubscription}
          subscriptionPlan={subscriptionPlan}
        />
      </CardContent>
    </Card>
  );
}
