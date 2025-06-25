
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { TransactionRecord } from "@/types/transaction";
import { DateRange } from "react-day-picker";

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
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchTransactions();
  }, [currentPage, statusFilter, dateRange]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("No active session");
      }

      // Build query parameters
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      });

      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      if (dateRange?.from) {
        params.append("dateFrom", dateRange.from.toISOString());
      }

      if (dateRange?.to) {
        params.append("dateTo", dateRange.to.toISOString());
      }

      // Call the edge function with query parameters
      const functionUrl = `${supabase.supabaseUrl}/functions/v1/get-admin-transactions?${params.toString()}`;
      
      const response = await fetch(functionUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch transactions');
      }

      const data = await response.json() as AdminTransactionsResponse;
      setTransactions(data.transactions || []);
      setTotalPages(data.pagination?.totalPages || 1);

    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast({
        title: "Error",
        description: "Failed to fetch transaction history",
        variant: "destructive",
      });
      setTransactions([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

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
    dateRange,
    setDateRange,
    currentPage,
    setCurrentPage,
    totalPages,
  };
}
