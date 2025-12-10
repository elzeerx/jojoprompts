import { DashboardKPICards } from "./dashboard/DashboardKPICards";
import { DashboardCharts } from "./dashboard/DashboardCharts";
import { RecentActivityCard } from "./dashboard/RecentActivityCard";
import { useDashboardData } from "./dashboard/useDashboardData";

export default function DashboardOverview() {
  const { kpiData, chartData, loading } = useDashboardData();

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <DashboardKPICards data={kpiData} loading={loading} />
      
      {/* Charts Section */}
      <DashboardCharts data={chartData} loading={loading} />
      
      {/* Recent Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RecentActivityCard />
      </div>
    </div>
  );
}
