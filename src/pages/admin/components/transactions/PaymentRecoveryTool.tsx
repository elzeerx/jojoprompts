import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PendingTransaction {
  id: string;
  paypal_order_id: string;
  paypal_payment_id: string | null;
  user_id: string;
  plan_id: string;
  amount_usd: number;
  status: string;
  created_at: string;
}

interface RecoveryResult {
  processed: number;
  captured: number;
  failed: number;
  expired: number;
  skipped: number;
  details: Array<{
    transactionId: string;
    orderId: string;
    status: string;
    paymentId?: string;
    amount?: number;
    reason?: string;
  }>;
}

export function PaymentRecoveryTool() {
  const [isLoading, setIsLoading] = useState(false);
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [lastRecoveryResult, setLastRecoveryResult] = useState<RecoveryResult | null>(null);
  const { toast } = useToast();

  const fetchPendingTransactions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, paypal_order_id, paypal_payment_id, user_id, plan_id, amount_usd, status, created_at')
        .eq('status', 'pending')
        .not('paypal_order_id', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPendingTransactions(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to fetch pending transactions: ${error.message}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  const runAutoCapture = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('auto-capture-paypal', {
        body: {}
      });

      if (error) throw error;

      setLastRecoveryResult(data);
      
      // Refresh the pending transactions list
      await fetchPendingTransactions();

      toast({
        title: "Recovery Complete",
        description: `Processed ${data.processed} transactions: ${data.captured} captured, ${data.failed} failed, ${data.expired} expired`
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Recovery Failed",
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getTransactionAge = (createdAt: string) => {
    const age = Date.now() - new Date(createdAt).getTime();
    const hours = Math.floor(age / (1000 * 60 * 60));
    const minutes = Math.floor((age % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      return { text: `${Math.floor(hours / 24)}d ${hours % 24}h`, isOld: true };
    } else if (hours > 0) {
      return { text: `${hours}h ${minutes}m`, isOld: hours > 3 };
    } else {
      return { text: `${minutes}m`, isOld: false };
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'captured':
      case 'already_completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
      case 'capture_failed':
      case 'expired':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'skipped':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            PayPal Payment Recovery Tool
          </CardTitle>
          <CardDescription>
            Automatically capture approved PayPal orders and clean up pending transactions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button 
              onClick={fetchPendingTransactions}
              disabled={isLoading}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Pending
            </Button>
            <Button 
              onClick={runAutoCapture}
              disabled={isLoading || pendingTransactions.length === 0}
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Run Auto-Capture
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{pendingTransactions.length}</div>
                <p className="text-xs text-muted-foreground">Pending Transactions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-yellow-600">
                  {pendingTransactions.filter(tx => {
                    const age = Date.now() - new Date(tx.created_at).getTime();
                    return age > 3 * 60 * 60 * 1000; // > 3 hours
                  }).length}
                </div>
                <p className="text-xs text-muted-foreground">Older than 3 hours</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-red-600">
                  {pendingTransactions.filter(tx => {
                    const age = Date.now() - new Date(tx.created_at).getTime();
                    return age > 24 * 60 * 60 * 1000; // > 24 hours
                  }).length}
                </div>
                <p className="text-xs text-muted-foreground">Older than 24 hours</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {pendingTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Transactions</CardTitle>
            <CardDescription>
              Transactions with PayPal order IDs but no payment IDs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingTransactions.map((tx) => {
                const age = getTransactionAge(tx.created_at);
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div>
                        <div className="font-medium">${tx.amount_usd}</div>
                        <div className="text-sm text-muted-foreground">
                          Order: {tx.paypal_order_id.slice(0, 12)}...
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant={age.isOld ? "destructive" : "secondary"}
                      >
                        {age.text}
                      </Badge>
                      <Badge variant="outline">{tx.status}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {lastRecoveryResult && (
        <Card>
          <CardHeader>
            <CardTitle>Last Recovery Results</CardTitle>
            <CardDescription>
              Results from the most recent auto-capture run
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
              <div className="text-center">
                <div className="text-lg font-bold">{lastRecoveryResult.processed}</div>
                <div className="text-xs text-muted-foreground">Processed</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">{lastRecoveryResult.captured}</div>
                <div className="text-xs text-muted-foreground">Captured</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-red-600">{lastRecoveryResult.failed}</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-orange-600">{lastRecoveryResult.expired}</div>
                <div className="text-xs text-muted-foreground">Expired</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-yellow-600">{lastRecoveryResult.skipped}</div>
                <div className="text-xs text-muted-foreground">Skipped</div>
              </div>
            </div>

            {lastRecoveryResult.details.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Transaction Details</h4>
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {lastRecoveryResult.details.map((detail, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(detail.status)}
                        <span>
                          {detail.orderId.slice(0, 12)}...
                          {detail.amount && ` ($${detail.amount})`}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs">
                          {detail.status}
                        </Badge>
                        {detail.reason && (
                          <span className="text-xs text-muted-foreground">
                            {detail.reason}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}