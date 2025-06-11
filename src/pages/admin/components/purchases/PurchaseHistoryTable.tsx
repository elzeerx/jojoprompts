
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { useState } from "react";
import { PurchaseDetailsDialog } from "./PurchaseDetailsDialog";

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

interface PurchaseHistoryTableProps {
  payments: PaymentRecord[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function PurchaseHistoryTable({ 
  payments, 
  currentPage, 
  totalPages, 
  onPageChange 
}: PurchaseHistoryTableProps) {
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);

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
    <>
      <Card className="border-warm-gold/20">
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Amount (USD)</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-mono text-sm">
                      {new Date(payment.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate">
                        {payment.user_email || 'Unknown'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[150px] truncate">
                        {payment.subscription?.plan_name || 'Unknown Plan'}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">
                      ${payment.amount_usd.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge className={getPaymentMethodColor(payment.payment_method)}>
                        {payment.payment_method}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(payment.status)}>
                        {payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {payment.discount_code?.code ? (
                        <div className="text-sm">
                          <div className="font-medium">{payment.discount_code.code}</div>
                          <div className="text-muted-foreground">
                            -${(payment.discount_amount_usd || 0).toFixed(2)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedPayment(payment)}
                        className="h-8 w-8 p-0"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <PurchaseDetailsDialog
        payment={selectedPayment}
        open={!!selectedPayment}
        onOpenChange={(open) => !open && setSelectedPayment(null)}
      />
    </>
  );
}
