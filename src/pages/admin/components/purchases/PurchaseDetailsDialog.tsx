
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Payment {
  id: string;
  user_id: string;
  amount_usd: number;
  payment_method: string;
  payment_id: string | null;
  status: string;
  created_at: string;
  discount_code_id: string | null;
  discount_amount_usd: number | null;
  original_amount_usd: number | null;
  subscription?: {
    plan_name: string;
  };
  user_email?: string;
  discount_code?: {
    code: string;
  };
}

interface PurchaseDetailsDialogProps {
  payment: Payment | null;
  open: boolean;
  onClose: () => void;
}

export function PurchaseDetailsDialog({ payment, open, onClose }: PurchaseDetailsDialogProps) {
  if (!payment) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Purchase Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{payment.user_email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">User ID:</span>
                <span className="font-mono text-sm">{payment.user_id}</span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment ID:</span>
                <span className="font-mono text-sm">{payment.payment_id || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date:</span>
                <span>{new Date(payment.created_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Method:</span>
                <Badge variant="secondary" className="capitalize">
                  {payment.payment_method}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <Badge className={
                  payment.status === 'completed' ? 'bg-green-100 text-green-800' :
                  payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  payment.status === 'failed' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }>
                  {payment.status}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Subscription Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Subscription Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan:</span>
                <Badge variant="outline" className="border-warm-gold/30">
                  {payment.subscription?.plan_name}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Amount Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Amount Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {payment.original_amount_usd && payment.discount_amount_usd ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Original Amount:</span>
                    <div className="font-medium">${payment.original_amount_usd}</div>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Discount ({payment.discount_code?.code}):</span>
                    <div>-${payment.discount_amount_usd}</div>
                  </div>
                  <Separator />
                </>
              ) : null}
              <div className="flex justify-between font-semibold text-lg">
                <span>Final Amount:</span>
                <div>${payment.amount_usd}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
