
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { useState } from "react";
import { PurchaseDetailsDialog } from "./PurchaseDetailsDialog";
import { TransactionRecord } from "@/types/transaction";
import { getStatusBadgeColor, formatAmountUSD, formatDate } from "@/utils/transactionUtils";

interface PurchaseHistoryTableProps {
  payments: TransactionRecord[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function TransactionStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={getStatusBadgeColor(status)}>
      {status}
    </Badge>
  );
}

export function PurchaseHistoryTable({
  payments,
  currentPage,
  totalPages,
  onPageChange,
}: PurchaseHistoryTableProps) {
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionRecord | null>(null);

  return (
    <>
      <Card className="border-warm-gold/20">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Amount (USD)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell>
                  {formatDate(transaction.created_at)}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{transaction.user_email}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="border-warm-gold/30">
                    {transaction.plan?.name}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{formatAmountUSD(transaction.amount_usd)}</div>
                </TableCell>
                <TableCell>
                  <TransactionStatusBadge status={transaction.status} />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedTransaction(transaction)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
      <PurchaseDetailsDialog
        payment={selectedTransaction}
        open={!!selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />
    </>
  );
}
