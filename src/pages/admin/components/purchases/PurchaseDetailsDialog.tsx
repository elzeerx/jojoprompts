
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionRecord } from "@/types/transaction";
import { formatDate, formatAmountUSD } from "@/utils/transactionUtils";

interface PurchaseDetailsDialogProps {
  payment: TransactionRecord | null;
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

          {/* Transaction Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Transaction Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transaction ID:</span>
                <span className="font-mono text-sm">{payment.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date:</span>
                <span>{formatDate(payment.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <Badge className={payment.status === 'completed' ? 'bg-green-100 text-green-800' : payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : payment.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}>
                  {payment.status}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Plan & Amount Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Purchase Info</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan:</span>
                <Badge variant="outline" className="border-warm-gold/30">{payment.plan?.name ?? "—"}</Badge>
              </div>
              <div className="flex justify-between mt-2 font-semibold text-lg">
                <span>Amount:</span>
                <div>{formatAmountUSD(payment.amount_usd)}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
