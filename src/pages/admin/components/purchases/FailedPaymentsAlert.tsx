import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface FailedPayment {
  id: string;
  user_email: string;
  amount_usd: number;
  payment_gateway: string;
  created_at: string;
  error_message: string | null;
}

export function FailedPaymentsAlert() {
  const [failedPayments, setFailedPayments] = useState<FailedPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchFailedPayments = async () => {
    setLoading(true);
    try {
      // Get failed transactions from the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: transactions, error } = await supabase
        .from('transactions')
        .select(`
          id,
          amount_usd,
          payment_gateway,
          created_at,
          error_message,
          user_id
        `)
        .eq('status', 'failed')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      if (transactions && transactions.length > 0) {
        // Fetch user emails
        const userIds = [...new Set(transactions.map(t => t.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p.email]) || []);

        const enrichedTransactions = transactions.map(t => ({
          id: t.id,
          user_email: profileMap.get(t.user_id) || 'Unknown',
          amount_usd: t.amount_usd,
          payment_gateway: t.payment_gateway || 'Unknown',
          created_at: t.created_at,
          error_message: t.error_message,
        }));

        setFailedPayments(enrichedTransactions);
      } else {
        setFailedPayments([]);
      }
    } catch (error) {
      console.error('Error fetching failed payments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFailedPayments();
  }, []);

  if (loading) {
    return null;
  }

  if (failedPayments.length === 0) {
    return null;
  }

  return (
    <Alert className="border-rose-200 bg-rose-50">
      <AlertTriangle className="h-4 w-4 text-rose-600" />
      <AlertTitle className="text-rose-800 flex items-center justify-between">
        <span className="flex items-center gap-2">
          Failed Payments Alert
          <Badge variant="destructive" className="text-xs">
            {failedPayments.length} in last 7 days
          </Badge>
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchFailedPayments}
            className="h-7 text-rose-600 hover:text-rose-700 hover:bg-rose-100"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-7 text-rose-600 hover:text-rose-700 hover:bg-rose-100"
          >
            {expanded ? 'Hide' : 'Show'} Details
          </Button>
        </div>
      </AlertTitle>
      
      <AlertDescription className="text-rose-700">
        <p className="text-sm mt-1">
          {failedPayments.length} payment{failedPayments.length !== 1 ? 's' : ''} failed recently. Review and follow up with affected users.
        </p>

        {expanded && (
          <div className="mt-3 space-y-2">
            {failedPayments.slice(0, 5).map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between p-2 bg-white/50 rounded-lg text-sm"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{payment.user_email}</p>
                  <p className="text-xs text-rose-600/70">
                    ${payment.amount_usd.toFixed(2)} via {payment.payment_gateway} • {format(new Date(payment.created_at), 'MMM d, h:mm a')}
                  </p>
                </div>
                {payment.error_message && (
                  <Badge variant="outline" className="text-xs border-rose-300 text-rose-600 ml-2">
                    {payment.error_message.slice(0, 20)}...
                  </Badge>
                )}
              </div>
            ))}
            {failedPayments.length > 5 && (
              <p className="text-xs text-rose-600/70 text-center">
                +{failedPayments.length - 5} more failed payments
              </p>
            )}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
