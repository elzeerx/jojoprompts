import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/utils/logging";
import { handleError } from "@/utils/errorHandler";
import { KPIData } from "./DashboardKPICards";
import { ChartData } from "./DashboardCharts";
import { TopPrompt } from "./TopPromptsCard";
import { CategoryData, CATEGORY_COLORS } from "./CategoryDistributionCard";
import { ActivityItem } from "./ActivityTimelineCard";

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

export interface InsightsData {
  topPrompts: TopPrompt[];
  categoryDistribution: CategoryData[];
  recentActivity: ActivityItem[];
}

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
    abandonedCarts: 0,
    recoveredRevenue: 0,
    recoveryRate: 0,
  });

  const [chartData, setChartData] = useState<ChartData>({
    revenueByMonth: [],
    usersByMonth: [],
  });

  const [insightsData, setInsightsData] = useState<InsightsData>({
    topPrompts: [],
    categoryDistribution: [],
    recentActivity: [],
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
        favoritesResult,
        abandonedCartsResult,
      ] = await Promise.all([
        supabase.from("prompts").select("id, title, prompt_type, metadata, created_at, user_id"),
        supabase.from("profiles").select("id, first_name, last_name, username, avatar_url, created_at"),
        supabase.from("transactions").select("id, amount_usd, status, completed_at, created_at, user_id"),
        supabase.from("user_subscriptions").select("id, plan_id, status, created_at, user_id"),
        supabase.from("subscription_plans").select("id, tier, name"),
        supabase.from("favorites").select("prompt_id, user_id, created_at"),
        supabase.from("abandoned_cart_sequences").select("id, status, plan_price, conversion_date"),
      ]);

      // Process prompts
      const prompts = promptsResult.data || [];
      const users = usersResult.data || [];
      const favorites = favoritesResult.data || [];
      
      // Create user lookup map
      const userMap = new Map(users.map(u => [u.id, u]));

      const chatgptPrompts = prompts.filter(p => {
        const metadata = p.metadata as Record<string, unknown> | null;
        return p.prompt_type === 'chatgpt' || 
          metadata?.model_type === 'chatgpt' ||
          (typeof metadata?.category === 'string' && metadata.category.toLowerCase().includes('chatgpt'));
      }).length;

      // Process users
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

      // Process abandoned cart sequences
      const abandonedCarts = abandonedCartsResult.data || [];
      const activeAbandonedCarts = abandonedCarts.filter(c => c.status === 'active').length;
      const convertedCarts = abandonedCarts.filter(c => c.status === 'converted');
      const recoveredRevenue = convertedCarts.reduce((sum, c) => sum + (c.plan_price || 0), 0);
      const totalSequences = abandonedCarts.length;
      const recoveryRate = totalSequences > 0 ? (convertedCarts.length / totalSequences) * 100 : 0;

      // Process subscriptions with plan tiers
      const subscriptions = subscriptionsResult.data || [];
      const plans = plansResult.data || [];
      const planTierMap = new Map(plans.map(p => [p.id, p.tier]));
      const planNameMap = new Map(plans.map(p => [p.id, p.name]));

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

      // ============ PHASE 3: Insights Data ============

      // Top prompts by favorites count
      const favoritesCountMap = new Map<string, number>();
      favorites.forEach(f => {
        const count = favoritesCountMap.get(f.prompt_id) || 0;
        favoritesCountMap.set(f.prompt_id, count + 1);
      });

      const topPrompts: TopPrompt[] = prompts
        .map(p => {
          const metadata = p.metadata as Record<string, unknown> | null;
          return {
            id: p.id,
            title: p.title,
            category: (metadata?.category as string) || p.prompt_type || 'General',
            favoritesCount: favoritesCountMap.get(p.id) || 0,
          };
        })
        .filter(p => p.favoritesCount > 0)
        .sort((a, b) => b.favoritesCount - a.favoritesCount)
        .slice(0, 5);

      // Category distribution
      const categoryCountMap = new Map<string, number>();
      prompts.forEach(p => {
        const metadata = p.metadata as Record<string, unknown> | null;
        const category = ((metadata?.category as string) || p.prompt_type || 'other').toLowerCase();
        const count = categoryCountMap.get(category) || 0;
        categoryCountMap.set(category, count + 1);
      });

      const categoryDistribution: CategoryData[] = Array.from(categoryCountMap.entries())
        .map(([name, count]) => ({
          name,
          count,
          color: CATEGORY_COLORS[name] || CATEGORY_COLORS.other,
        }))
        .sort((a, b) => b.count - a.count);

      // Recent activity (combine prompts, users, and transactions)
      const recentActivity: ActivityItem[] = [];

      // Recent prompts
      prompts
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3)
        .forEach(p => {
          const user = userMap.get(p.user_id);
          recentActivity.push({
            id: `prompt-${p.id}`,
            type: 'prompt_created',
            title: 'New Prompt Created',
            description: p.title,
            timestamp: p.created_at,
            user: user ? {
              name: user.username || `${user.first_name} ${user.last_name}`,
              avatar: user.avatar_url || undefined,
            } : undefined,
          });
        });

      // Recent signups
      users
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3)
        .forEach(u => {
          recentActivity.push({
            id: `user-${u.id}`,
            type: 'user_signup',
            title: 'New User Signed Up',
            description: u.username || `${u.first_name} ${u.last_name}`,
            timestamp: u.created_at,
            user: {
              name: u.username || `${u.first_name} ${u.last_name}`,
              avatar: u.avatar_url || undefined,
            },
          });
        });

      // Recent payments
      completedTransactions
        .sort((a, b) => new Date(b.completed_at || b.created_at).getTime() - new Date(a.completed_at || a.created_at).getTime())
        .slice(0, 3)
        .forEach(t => {
          const user = userMap.get(t.user_id);
          recentActivity.push({
            id: `transaction-${t.id}`,
            type: 'payment_completed',
            title: 'Payment Completed',
            description: `$${t.amount_usd.toFixed(2)}`,
            timestamp: t.completed_at || t.created_at,
            user: user ? {
              name: user.username || `${user.first_name} ${user.last_name}`,
              avatar: user.avatar_url || undefined,
            } : undefined,
          });
        });

      // Sort all activities by timestamp and take top 8
      recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

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
        abandonedCarts: activeAbandonedCarts,
        recoveredRevenue,
        recoveryRate,
      });

      setChartData({
        revenueByMonth,
        usersByMonth,
      });

      setInsightsData({
        topPrompts,
        categoryDistribution,
        recentActivity: recentActivity.slice(0, 8),
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
      supabase.channel('dashboard-favorites')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'favorites' }, fetchDashboardData)
        .subscribe(),
      supabase.channel('dashboard-abandoned-carts')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'abandoned_cart_sequences' }, fetchDashboardData)
        .subscribe(),
    ];

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, []);

  return { kpiData, chartData, insightsData, loading, refetch: fetchDashboardData };
}
