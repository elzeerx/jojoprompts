import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

/**
 * V2 release-hardening: the previous PaymentRecoveryTool called the retired
 * `auto-capture-paypal` Edge Function to manually capture pending PayPal
 * orders. That flow (and PayPal-side capture in general) has been retired.
 *
 * This component is now a read-only legacy notice. Historical transaction
 * data is still queryable through the V2 admin surface; there is no
 * client-initiated recovery action in this pass.
 */
export function PaymentRecoveryTool() {
  return (
    <Card data-testid="payment-recovery-tool-retired">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600" aria-hidden />
          PayPal Payment Recovery — retired
        </CardTitle>
        <CardDescription>
          The legacy client-initiated PayPal auto-capture tool has been retired.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>
          Pending legacy PayPal transactions are no longer processed from the
          admin UI. Historical rows remain visible in the transactions table
          for audit and support purposes.
        </p>
        <p>
          For any active payment reconciliation, use the V2 UPayments
          reconciliation surface. No new backend action is created in this
          pass.
        </p>
      </CardContent>
    </Card>
  );
}
