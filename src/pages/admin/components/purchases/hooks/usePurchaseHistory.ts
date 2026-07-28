
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { TransactionRecord } from "@/types/transaction";
import { DateRange } from "react-day-picker";
import { createLogger } from '@/utils/logging';
import { handleError } from '@/utils/errorHandler';

const logger = createLogger('PURCHASE_HISTORY');

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AdminTransactionsResponse {
  transactions: TransactionRecord[];
  pagination: PaginationInfo;
}

export function usePurchaseHistory(itemsPerPage = 20) {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [gatewayFilter, setGatewayFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchTransactions();
  }, [currentPage, statusFilter, gatewayFilter, dateRange]);

  const fetchTransactions = async () => {
    // RETIRED (source-only, 2026-07-28): the `get-admin-transactions`
    // Edge Function is now a 410 stub. `PurchaseHistoryManagement`, the
    // only consumer of this hook, is not referenced by
    // `src/pages/admin/layout/adminSectionElements.tsx` — the legacy
    // purchases surface is unreachable from Admin V2.
    setLoading(true);
    logger.warn('get-admin-transactions is retired; hook returns empty page');
    setTransactions([]);
    setTotalPages(1);
    setLoading(false);
  };

  // Prevent unused-import warnings while the hook is neutralized.
  void supabase;
  void toast;
  void handleError;


  const filteredTransactions = transactions.filter(transaction => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      transaction.user_email?.toLowerCase().includes(searchLower) ||
      transaction.plan?.name?.toLowerCase().includes(searchLower)
    );
  });

  return {
    transactions: filteredTransactions,
    loading,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    gatewayFilter,
    setGatewayFilter,
    dateRange,
    setDateRange,
    currentPage,
    setCurrentPage,
    totalPages,
  };
}
