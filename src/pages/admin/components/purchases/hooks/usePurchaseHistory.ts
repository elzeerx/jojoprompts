
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { TransactionRecord } from "@/types/transaction";
import { DateRange } from "react-day-picker";

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, statusFilter, dateRange]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("transactions")
        .select(`
          id,
          user_id,
          amount_usd,
          status,
          created_at,
          plan_id(name)
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (dateRange?.from) query = query.gte("created_at", dateRange.from.toISOString());
      if (dateRange?.to) query = query.lte("created_at", dateRange.to.toISOString());

      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      const userIds = [...new Set(data?.map(t => t.user_id) || [])];
      const { data: userData } = await supabase.auth.admin.listUsers();

      const userEmailMap = new Map();
      if (userData && Array.isArray(userData)) {
        userData.forEach((user: any) => {
          userEmailMap.set(user.id, user.email);
        });
      }

      const enrichedTransactions: TransactionRecord[] = (data?.map(transaction => ({
        id: transaction.id,
        user_id: transaction.user_id,
        amount_usd: transaction.amount_usd,
        status: transaction.status,
        created_at: transaction.created_at,
        user_email: userEmailMap.get(transaction.user_id) || 'Unknown',
        plan: {
          name: transaction.plan_id?.name || 'Unknown Plan'
        }
      })) || []);

      setTransactions(enrichedTransactions);
      setTotalPages(Math.max(1, Math.ceil((count || 0) / itemsPerPage)));
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast({
        title: "Error",
        description: "Failed to fetch transaction history",
        variant: "destructive",
      });
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
