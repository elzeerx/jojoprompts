
import { TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { TransactionRecord } from "@/types/transaction";
import { formatAmountUSD, formatDate } from "@/utils/transactionUtils";
import { StatusBadge } from "./StatusBadge";
import { useState } from "react";
import { PurchaseDetailsDialog } from "./PurchaseDetailsDialog";

interface TableBodyProps {
  payments: TransactionRecord[];
}

export function PurchaseHistoryTableBody({ payments }: TableBodyProps) {
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionRecord | null>(null);

  return (
    <>
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
              <StatusBadge status={transaction.status} />
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
      <PurchaseDetailsDialog
        payment={selectedTransaction}
        open={!!selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />
    </>
  );
}
