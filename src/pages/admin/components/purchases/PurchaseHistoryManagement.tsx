
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

interface PaymentRecord {
  id: string;
  user_id: string;
  amount_usd: number;
  amount_kwd: number;
  payment_method: string;
  payment_id: string | null;
  status: string;
  created_at: string;
  discount_code_id: string | null;
  discount_amount_usd: number | null;
  discount_amount_kwd: number | null;
  original_amount_usd: number | null;
  original_amount_kwd: number | null;
  subscription?: {
    plan_name: string;
  };
  user_email?: string;
  discount_code?: {
    code: string;
  };
}

export default function PurchaseHistoryManagement() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;

  const fetchPayments = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("payment_history")
        .select(`
          *,
          user_subscriptions!inner(
            subscription_plans(name)
          ),
          discount_codes(code)
        `)
        .order("created_at", { ascending: false });

      // Apply filters
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      
      if (paymentMethodFilter !== "all") {
        query = query.eq("payment_method", paymentMethodFilter);
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

      // Get user emails for the payments
      const userIds = [...new Set(data?.map(p => p.user_id) || [])];
      const { data: userData } = await supabase.auth.admin.listUsers();
      
      const userEmailMap = new Map();
      if (userData && Array.isArray(userData)) {
        userData.forEach((user: any) => {
          userEmailMap.set(user.id, user.email);
        });
      }

      const enrichedPayments = data?.map(payment => ({
        ...payment,
        user_email: userEmailMap.get(payment.user_id) || 'Unknown',
        subscription: {
          plan_name: payment.user_subscriptions?.subscription_plans?.name || 'Unknown Plan'
        }
      })) || [];

      setPayments(enrichedPayments);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));
    } catch (error) {
      console.error("Error fetching payments:", error);
      toast({
        title: "Error",
        description: "Failed to fetch payment history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [currentPage, statusFilter, paymentMethodFilter, dateRange]);

  const filteredPayments = payments.filter(payment => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      payment.user_email?.toLowerCase().includes(searchLower) ||
      payment.payment_id?.toLowerCase().includes(searchLower) ||
      payment.subscription?.plan_name?.toLowerCase().includes(searchLower) ||
      payment.discount_code?.code?.toLowerCase().includes(searchLower)
    );
  });

  const exportToCSV = () => {
    const csvData = filteredPayments.map(payment => ({
      Date: new Date(payment.created_at).toLocaleDateString(),
      Email: payment.user_email,
      Plan: payment.subscription?.plan_name,
      'Amount USD': payment.amount_usd,
      'Amount KWD': payment.amount_kwd,
      'Payment Method': payment.payment_method,
      'Payment ID': payment.payment_id,
      Status: payment.status,
      'Discount Code': payment.discount_code?.code || '',
      'Discount Amount USD': payment.discount_amount_usd || 0,
      'Discount Amount KWD': payment.discount_amount_kwd || 0,
    }));
    
    const csv = [
      Object.keys(csvData[0] || {}).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payment_history_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-dark-base">Purchase History</h2>
          <p className="text-muted-foreground">View and analyze all user purchases</p>
        </div>
        <Button onClick={exportToCSV} className="bg-warm-gold hover:bg-warm-gold/90">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <PurchaseHistoryStats payments={filteredPayments} />

      <Card className="border-warm-gold/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email, payment ID..."
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
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Method</label>
              <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="tap">Tap Payments</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
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
          payments={filteredPayments}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}
