
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Users, Percent } from "lucide-react";

interface Payment {
  amount_usd: number;
  status: string;
  discount_amount_usd: number | null;
  user_id: string;
}

interface PurchaseHistoryStatsProps {
  payments: Payment[];
}

export function PurchaseHistoryStats({ payments }: PurchaseHistoryStatsProps) {
  const completedPayments = payments.filter(p => p.status === 'completed');
  const totalRevenueUSD = completedPayments.reduce((sum, p) => sum + p.amount_usd, 0);
  const totalDiscountUSD = completedPayments.reduce((sum, p) => sum + (p.discount_amount_usd || 0), 0);
  const uniqueCustomers = new Set(completedPayments.map(p => p.user_id)).size;
  const paymentsWithDiscount = completedPayments.filter(p => p.discount_amount_usd && p.discount_amount_usd > 0);
  const discountUsageRate = completedPayments.length > 0 ? (paymentsWithDiscount.length / completedPayments.length) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="border-warm-gold/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${totalRevenueUSD.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            USD only
          </p>
        </CardContent>
      </Card>

      <Card className="border-warm-gold/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{payments.length}</div>
          <p className="text-xs text-muted-foreground">
            {completedPayments.length} completed
          </p>
        </CardContent>
      </Card>

      <Card className="border-warm-gold/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Unique Customers</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{uniqueCustomers}</div>
          <p className="text-xs text-muted-foreground">
            Paying customers
          </p>
        </CardContent>
      </Card>

      <Card className="border-warm-gold/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Discount Usage</CardTitle>
          <Percent className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{discountUsageRate.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground">
            ${totalDiscountUSD.toLocaleString()} saved
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
