
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface PaymentRecord {
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
  payment: PaymentRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PurchaseDetailsDialog({ payment, open, onOpenChange }: PurchaseDetailsDialogProps) {
  if (!payment) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'refunded':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPaymentMethodColor = (method: string) => {
    switch (method) {
      case 'paypal':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'tap':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'stripe':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'admin_assigned':
        return 'bg-warm-gold/20 text-warm-gold border-warm-gold/30';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Payment Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Payment Status and Method */}
          <div className="flex items-center gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <div className="mt-1">
                <Badge className={getStatusColor(payment.status)}>
                  {payment.status}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Payment Method</label>
              <div className="mt-1">
                <Badge className={getPaymentMethodColor(payment.payment_method)}>
                  {payment.payment_method}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Customer Information */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Customer Email</label>
              <p className="mt-1 font-mono text-sm">{payment.user_email || 'Unknown'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">User ID</label>
              <p className="mt-1 font-mono text-sm">{payment.user_id}</p>
            </div>
          </div>

          <Separator />

          {/* Plan Information */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">Subscription Plan</label>
            <p className="mt-1 text-sm">{payment.subscription?.plan_name || 'Unknown Plan'}</p>
          </div>

          <Separator />

          {/* Payment Amount Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Payment Details</h3>
            
            {payment.original_amount_usd && payment.original_amount_usd !== payment.amount_usd && (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Original Amount</label>
                  <p className="mt-1 font-mono text-sm">${payment.original_amount_usd.toFixed(2)} USD</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Discount Applied</label>
                  <p className="mt-1 font-mono text-sm text-green-600">
                    -${(payment.discount_amount_usd || 0).toFixed(2)} USD
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Final Amount</label>
                <p className="mt-1 font-mono text-lg font-semibold">${payment.amount_usd.toFixed(2)} USD</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Payment Date</label>
                <p className="mt-1 font-mono text-sm">
                  {new Date(payment.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Discount Information */}
          {payment.discount_code?.code && (
            <>
              <Separator />
              <div>
                <label className="text-sm font-medium text-muted-foreground">Discount Code Used</label>
                <p className="mt-1 font-mono text-sm">{payment.discount_code.code}</p>
              </div>
            </>
          )}

          {/* Transaction Details */}
          {payment.payment_id && (
            <>
              <Separator />
              <div>
                <label className="text-sm font-medium text-muted-foreground">Transaction ID</label>
                <p className="mt-1 font-mono text-sm break-all">{payment.payment_id}</p>
              </div>
            </>
          )}

          <Separator />

          {/* System Information */}
          <div className="grid grid-cols-2 gap-6 text-xs text-muted-foreground">
            <div>
              <label className="font-medium">Payment ID</label>
              <p className="mt-1 font-mono break-all">{payment.id}</p>
            </div>
            <div>
              <label className="font-medium">Created At</label>
              <p className="mt-1 font-mono">{new Date(payment.created_at).toISOString()}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
