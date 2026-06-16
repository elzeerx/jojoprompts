import { DashboardHeader } from "./dashboard/DashboardHeader";
import { DashboardKPICards } from "./dashboard/DashboardKPICards";
import { TopPromptsCard } from "./dashboard/TopPromptsCard";
import { QuickActionsPanel } from "./dashboard/QuickActionsPanel";
import { useDashboardData } from "./dashboard/useDashboardData";

/**
 * Overview = lightweight landing for /admin
 * Heavy charts and breakdowns moved to /admin/analytics.
 */
export default function DashboardOverview() {
  const { kpiData, insightsData, loading, refetch } = useDashboardData();

  return (
    <div className="space-y-6">
      <DashboardHeader pendingTransactions={kpiData.pendingTransactions} />
      <QuickActionsPanel onRefresh={refetch} isRefreshing={loading} />
      <DashboardKPICards data={kpiData} loading={loading} />
      <div className="grid gap-4 md:grid-cols-1">
        <TopPromptsCard prompts={insightsData.topPrompts} loading={loading} />
      </div>
    </div>
  );
}
