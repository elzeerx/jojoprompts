
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, CreditCard, TrendingUp } from "lucide-react";

interface PaymentRecord {
  id: string;
  user_id: string;
  amount_usd: number;
  payment_method: string;
  payment_id: string | null;
  status: string;
  created_at: string;
  discount_code_id: string | null;
  discount_amount_usd: number | null;
  original_amount_usd: number | null;
  subscription?: {
    plan_name: string;
  };
  user_email?: string;
  discount_code?: {
    code: string;
  };
}

interface PurchaseHistoryStatsProps {
  payments: PaymentRecord[];
}

export function PurchaseHistoryStats({ payments }: PurchaseHistoryStatsProps) {
  const totalRevenue = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, payment) => sum + payment.amount_usd, 0);

  const totalCustomers = new Set(
    payments
      .filter(p => p.status === 'completed')
      .map(p => p.user_id)
  ).size;

  const successfulPayments = payments.filter(p => p.status === 'completed').length;
  const totalPayments = payments.length;
  const successRate = totalPayments > 0 ? (successfulPayments / totalPayments) * 100 : 0;

  const avgOrderValue = successfulPayments > 0 ? totalRevenue / successfulPayments : 0;

  const stats = [
    {
      title: "Total Revenue",
      value: `$${totalRevenue.toFixed(2)}`,
      icon: DollarSign,
      description: "From completed payments"
    },
    {
      title: "Total Customers",
      value: totalCustomers.toString(),
      icon: Users,
      description: "Unique paying customers"
    },
    {
      title: "Success Rate",
      value: `${successRate.toFixed(1)}%`,
      icon: TrendingUp,
      description: `${successfulPayments}/${totalPayments} payments`
    },
    {
      title: "Avg Order Value",
      value: `$${avgOrderValue.toFixed(2)}`,
      icon: CreditCard,
      description: "Per successful payment"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="border-warm-gold/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-warm-gold" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-dark-base">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
