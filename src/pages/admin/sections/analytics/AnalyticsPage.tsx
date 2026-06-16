import { DashboardCharts } from "@/pages/admin/components/dashboard/DashboardCharts";
import { CategoryDistributionCard } from "@/pages/admin/components/dashboard/CategoryDistributionCard";
import { ActivityTimelineCard } from "@/pages/admin/components/dashboard/ActivityTimelineCard";
import { useDashboardData } from "@/pages/admin/components/dashboard/useDashboardData";

/**
 * Analytics = deeper drill-downs (charts, distribution, activity timeline).
 * Lives at /admin/analytics. Split out of the old Overview in Phase 2.
 */
export default function AnalyticsPage() {
  const { chartData, insightsData, loading } = useDashboardData();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-dark-base">
          Analytics
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Revenue trends, signups, category distribution, and recent activity.
        </p>
      </div>

      <DashboardCharts data={chartData} loading={loading} />

      <div className="grid gap-4 md:grid-cols-2">
        <CategoryDistributionCard
          categories={insightsData.categoryDistribution}
          loading={loading}
        />
        <ActivityTimelineCard
          activities={insightsData.recentActivity}
          loading={loading}
        />
      </div>
    </div>
  );
}
