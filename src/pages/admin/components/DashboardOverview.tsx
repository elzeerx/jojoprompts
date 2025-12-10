import { DashboardKPICards } from "./dashboard/DashboardKPICards";
import { DashboardCharts } from "./dashboard/DashboardCharts";
import { TopPromptsCard } from "./dashboard/TopPromptsCard";
import { CategoryDistributionCard } from "./dashboard/CategoryDistributionCard";
import { ActivityTimelineCard } from "./dashboard/ActivityTimelineCard";
import { QuickActionsPanel } from "./dashboard/QuickActionsPanel";
import { useDashboardData } from "./dashboard/useDashboardData";

export default function DashboardOverview() {
  const { kpiData, chartData, insightsData, loading, refetch } = useDashboardData();

  return (
    <div className="space-y-6">
      {/* Quick Actions Panel - Phase 4 */}
      <QuickActionsPanel onRefresh={refetch} isRefreshing={loading} />
      
      {/* KPI Cards Grid */}
      <DashboardKPICards data={kpiData} loading={loading} />
      
      {/* Charts Section */}
      <DashboardCharts data={chartData} loading={loading} />
      
      {/* Quick Insights Grid - Phase 3 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <TopPromptsCard 
          prompts={insightsData.topPrompts} 
          loading={loading} 
        />
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
