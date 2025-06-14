import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Download, Search, Filter } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { PurchaseHistoryTable } from "./PurchaseHistoryTable";
import { PurchaseHistoryStats } from "./PurchaseHistoryStats";
import { DateRange } from "react-day-picker";

interface TransactionRecord {
  id: string;
  user_id: string;
  amount_usd: number;
  status: string;
  created_at: string;
  plan?: {
    name: string;
  };
  user_email?: string;
}

export default function PurchaseHistoryManagement() {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;

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

      // Apply filters
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (dateRange?.from) {
        query = query.gte("created_at", dateRange.from.toISOString());
      }
      
      if (dateRange?.to) {
        query = query.lte("created_at", dateRange.to.toISOString());
      }

      // Pagination
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      // Get user emails for the transactions
      const userIds = [...new Set(data?.map(t => t.user_id) || [])];
      const { data: userData } = await supabase.auth.admin.listUsers();
      
      const userEmailMap = new Map();
      if (userData && Array.isArray(userData)) {
        userData.forEach((user: any) => {
          userEmailMap.set(user.id, user.email);
        });
      }

      const enrichedTransactions = data?.map(transaction => ({
        ...transaction,
        user_email: userEmailMap.get(transaction.user_id) || 'Unknown',
        plan: {
          name: transaction.plan_id?.name || 'Unknown Plan'
        }
      })) || [];

      setTransactions(enrichedTransactions);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));
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

  useEffect(() => {
    fetchTransactions();
  }, [currentPage, statusFilter, dateRange]);

  const filteredTransactions = transactions.filter(transaction => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      transaction.user_email?.toLowerCase().includes(searchLower) ||
      transaction.plan?.name?.toLowerCase().includes(searchLower)
    );
  });

  const exportToCSV = () => {
    const csvData = filteredTransactions.map(transaction => ({
      Date: new Date(transaction.created_at).toLocaleDateString(),
      Email: transaction.user_email,
      Plan: transaction.plan?.name,
      'Amount USD': transaction.amount_usd,
      Status: transaction.status,
    }));
    
    const csv = [
      Object.keys(csvData[0] || {}).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transaction_history_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-dark-base">Transaction History</h2>
          <p className="text-muted-foreground">View and analyze all user transactions</p>
        </div>
        <Button onClick={exportToCSV} className="bg-warm-gold hover:bg-warm-gold/90">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <PurchaseHistoryStats payments={filteredTransactions} />

      <Card className="border-warm-gold/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email, plan..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <DatePickerWithRange
                value={dateRange}
                onChange={setDateRange}
                placeholder="Select date range"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-warm-gold" />
        </div>
      ) : (
        <PurchaseHistoryTable
          payments={filteredTransactions} // Now TransactionRecord[]
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}
