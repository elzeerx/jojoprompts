import { DollarSign, Crown, Users, FileText, TrendingUp, Clock, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface KPIData {
  totalRevenue: number;
  revenueThisMonth: number;
  activeSubscribers: number;
  subscribersByTier: { basic: number; standard: number; premium: number; ultimate: number };
  totalUsers: number;
  usersThisWeek: number;
  totalPrompts: number;
  promptsByType: { chatgpt: number; other: number };
  conversionRate: number;
  pendingTransactions: number;
}

interface DashboardKPICardsProps {
  data: KPIData;
  loading: boolean;
}

export function DashboardKPICards({ data, loading }: DashboardKPICardsProps) {
  const cards = [
    {
      title: "Total Revenue",
      value: `$${data.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      subtext: data.revenueThisMonth > 0 
        ? `+$${data.revenueThisMonth.toFixed(2)} this month` 
        : "No revenue this month",
      subtextColor: data.revenueThisMonth > 0 ? "text-emerald-600" : "text-muted-foreground",
      icon: DollarSign,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
    {
      title: "Active Subscribers",
      value: data.activeSubscribers.toString(),
      subtext: `${data.subscribersByTier.premium + data.subscribersByTier.ultimate} Premium+`,
      subtextColor: "text-warm-gold",
      icon: Crown,
      iconBg: "bg-amber-50",
      iconColor: "text-warm-gold",
      badges: [
        { label: "Basic", count: data.subscribersByTier.basic, color: "bg-gray-100 text-gray-600" },
        { label: "Std", count: data.subscribersByTier.standard, color: "bg-blue-100 text-blue-600" },
        { label: "Prm", count: data.subscribersByTier.premium, color: "bg-purple-100 text-purple-600" },
        { label: "Ult", count: data.subscribersByTier.ultimate, color: "bg-amber-100 text-amber-700" },
      ],
    },
    {
      title: "Total Users",
      value: data.totalUsers.toString(),
      subtext: data.usersThisWeek > 0 
        ? `+${data.usersThisWeek} this week` 
        : "No new users this week",
      subtextColor: data.usersThisWeek > 0 ? "text-emerald-600" : "text-muted-foreground",
      icon: Users,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      title: "Total Prompts",
      value: data.totalPrompts.toString(),
      subtext: `${data.promptsByType.chatgpt} ChatGPT, ${data.promptsByType.other} others`,
      subtextColor: "text-muted-foreground",
      icon: FileText,
      iconBg: "bg-violet-50",
      iconColor: "text-violet-600",
    },
    {
      title: "Conversion Rate",
      value: `${data.conversionRate.toFixed(1)}%`,
      subtext: "Users → Paid",
      subtextColor: "text-muted-foreground",
      icon: TrendingUp,
      iconBg: "bg-teal-50",
      iconColor: "text-muted-teal",
    },
    {
      title: "Pending Transactions",
      value: data.pendingTransactions.toString(),
      subtext: "Awaiting completion",
      subtextColor: data.pendingTransactions > 10 ? "text-amber-600" : "text-muted-foreground",
      icon: Clock,
      iconBg: data.pendingTransactions > 10 ? "bg-amber-50" : "bg-gray-50",
      iconColor: data.pendingTransactions > 10 ? "text-amber-600" : "text-gray-500",
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => (
        <Card 
          key={card.title} 
          className="rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 bg-white"
        >
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
                {card.title}
              </span>
              <div className={cn("p-2 rounded-lg", card.iconBg)}>
                <card.icon className={cn("h-4 w-4", card.iconColor)} />
              </div>
            </div>
            
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-warm-gold" />
            ) : (
              <>
                <div className="text-2xl sm:text-3xl font-light tracking-tight text-dark-base mb-1">
                  {card.value}
                </div>
                <p className={cn("text-xs", card.subtextColor)}>
                  {card.subtext}
                </p>
                
                {card.badges && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {card.badges.map((badge) => (
                      <span 
                        key={badge.label}
                        className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", badge.color)}
                      >
                        {badge.count}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
