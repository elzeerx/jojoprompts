
import { Loader2, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PurchaseHistoryTable } from "./PurchaseHistoryTable";
import { PurchaseHistoryStats } from "./PurchaseHistoryStats";
import { usePurchaseHistory } from "./hooks/usePurchaseHistory";
import { PurchaseFilters } from "./PurchaseFilters";
import { exportTransactionsToCSV } from "./utils/exportTransactionsToCSV";

export default function PurchaseHistoryManagement() {
  const {
    transactions,
    loading,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    dateRange,
    setDateRange,
    currentPage,
    setCurrentPage,
    totalPages,
  } = usePurchaseHistory();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-dark-base">Transaction History</h2>
          <p className="text-muted-foreground">View and analyze all user transactions</p>
        </div>
        <Button onClick={() => exportTransactionsToCSV(transactions)} className="bg-warm-gold hover:bg-warm-gold/90">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <PurchaseHistoryStats payments={transactions} />

      <Card className="border-warm-gold/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PurchaseFilters
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            dateRange={dateRange}
            setDateRange={setDateRange}
          />
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-warm-gold" />
        </div>
      ) : (
        <PurchaseHistoryTable
          payments={transactions}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}
