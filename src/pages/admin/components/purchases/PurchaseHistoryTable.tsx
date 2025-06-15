
import { Table, TableHeader, TableRow, TableHead, Card } from "@/components/ui/table";
import { PurchaseHistoryTableBody } from "./PurchaseHistoryTableBody";
import { PurchaseHistoryPagination } from "./PurchaseHistoryPagination";
import { TransactionRecord } from "@/types/transaction";

interface PurchaseHistoryTableProps {
  payments: TransactionRecord[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function PurchaseHistoryTable({
  payments,
  currentPage,
  totalPages,
  onPageChange,
}: PurchaseHistoryTableProps) {
  return (
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
        <PurchaseHistoryTableBody payments={payments} />
      </Table>
      {totalPages > 1 && (
        <PurchaseHistoryPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      )}
    </Card>
  );
}
