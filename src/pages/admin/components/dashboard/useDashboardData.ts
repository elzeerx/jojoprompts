import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/utils/logging";
import { handleError } from "@/utils/errorHandler";
import { KPIData } from "./DashboardKPICards";
import { ChartData } from "./DashboardCharts";

const logger = createLogger("DASHBOARD_DATA");

const getMonthName = (date: Date): string => {
  return date.toLocaleDateString('en-US', { month: 'short' });
};

const getLastSixMonths = (): string[] => {
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(getMonthName(date));
  }
  return months;
};

export function useDashboardData() {
  const [kpiData, setKpiData] = useState<KPIData>({
    totalRevenue: 0,
    revenueThisMonth: 0,
    activeSubscribers: 0,
    subscribersByTier: { basic: 0, standard: 0, premium: 0, ultimate: 0 },
    totalUsers: 0,
    usersThisWeek: 0,
    totalPrompts: 0,
    promptsByType: { chatgpt: 0, other: 0 },
    conversionRate: 0,
    pendingTransactions: 0,
  });

  const [chartData, setChartData] = useState<ChartData>({
    revenueByMonth: [],
    usersByMonth: [],
  });

  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch all data in parallel
      const [
        promptsResult,
        usersResult,
        transactionsResult,
        subscriptionsResult,
        plansResult,
      ] = await Promise.all([
        supabase.from("prompts").select("id, prompt_type, metadata, created_at"),
        supabase.from("profiles").select("id, created_at"),
        supabase.from("transactions").select("id, amount_usd, status, completed_at, created_at"),
        supabase.from("user_subscriptions").select("id, plan_id, status, created_at"),
        supabase.from("subscription_plans").select("id, tier"),
      ]);

      // Process prompts
      const prompts = promptsResult.data || [];
      const chatgptPrompts = prompts.filter(p => {
        const metadata = p.metadata as Record<string, unknown> | null;
        return p.prompt_type === 'chatgpt' || 
          metadata?.model_type === 'chatgpt' ||
          (typeof metadata?.category === 'string' && metadata.category.toLowerCase().includes('chatgpt'));
      }).length;

      // Process users
      const users = usersResult.data || [];
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const usersThisWeek = users.filter(u => 
        new Date(u.created_at) >= oneWeekAgo
      ).length;

      // Process transactions
      const transactions = transactionsResult.data || [];
      const completedTransactions = transactions.filter(t => t.status === 'completed');
      const totalRevenue = completedTransactions.reduce((sum, t) => sum + (t.amount_usd || 0), 0);
      
      const revenueThisMonth = completedTransactions
        .filter(t => t.completed_at && new Date(t.completed_at) >= startOfMonth)
        .reduce((sum, t) => sum + (t.amount_usd || 0), 0);

      const pendingTransactions = transactions.filter(t => t.status === 'pending').length;

      // Process subscriptions with plan tiers
      const subscriptions = subscriptionsResult.data || [];
      const plans = plansResult.data || [];
      const planTierMap = new Map(plans.map(p => [p.id, p.tier]));

      const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
      const subscribersByTier = { basic: 0, standard: 0, premium: 0, ultimate: 0 };
      
      activeSubscriptions.forEach(sub => {
        const tier = planTierMap.get(sub.plan_id) as keyof typeof subscribersByTier;
        if (tier && subscribersByTier.hasOwnProperty(tier)) {
          subscribersByTier[tier]++;
        }
      });

      // Calculate conversion rate
      const conversionRate = users.length > 0 
        ? (activeSubscriptions.length / users.length) * 100 
        : 0;

      // Build chart data for last 6 months
      const months = getLastSixMonths();
      
      const revenueByMonth = months.map(month => {
        const monthRevenue = completedTransactions
          .filter(t => {
            if (!t.completed_at) return false;
            const transDate = new Date(t.completed_at);
            return getMonthName(transDate) === month;
          })
          .reduce((sum, t) => sum + (t.amount_usd || 0), 0);
        return { month, revenue: monthRevenue };
      });

      const usersByMonth = months.map(month => {
        const monthUsers = users.filter(u => {
          const userDate = new Date(u.created_at);
          return getMonthName(userDate) === month;
        }).length;
        return { month, users: monthUsers };
      });

      setKpiData({
        totalRevenue,
        revenueThisMonth,
        activeSubscribers: activeSubscriptions.length,
        subscribersByTier,
        totalUsers: users.length,
        usersThisWeek,
        totalPrompts: prompts.length,
        promptsByType: { chatgpt: chatgptPrompts, other: prompts.length - chatgptPrompts },
        conversionRate,
        pendingTransactions,
      });

      setChartData({
        revenueByMonth,
        usersByMonth,
      });

      setLoading(false);
    } catch (error) {
      const appError = handleError(error, { component: 'useDashboardData', action: 'fetchDashboardData' });
      logger.error('Error fetching dashboard data', { error: appError });
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Set up real-time listeners
    const channels = [
      supabase.channel('dashboard-prompts')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'prompts' }, fetchDashboardData)
        .subscribe(),
      supabase.channel('dashboard-profiles')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchDashboardData)
        .subscribe(),
      supabase.channel('dashboard-transactions')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchDashboardData)
        .subscribe(),
      supabase.channel('dashboard-subscriptions')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_subscriptions' }, fetchDashboardData)
        .subscribe(),
    ];

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, []);

  return { kpiData, chartData, loading, refetch: fetchDashboardData };
}
