import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface ChartData {
  revenueByMonth: { month: string; revenue: number }[];
  usersByMonth: { month: string; users: number }[];
}

interface DashboardChartsProps {
  data: ChartData;
  loading: boolean;
}

export function DashboardCharts({ data, loading }: DashboardChartsProps) {
  const CustomTooltip = ({ active, payload, label, valuePrefix = "" }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-100 shadow-lg rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">{label}</p>
          <p className="text-sm font-semibold text-dark-base">
            {valuePrefix}{payload[0].value.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Revenue Trend Chart */}
      <Card className="rounded-2xl border border-gray-100 shadow-sm bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-dark-base flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-warm-gold" />
            Revenue Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[200px] flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-warm-gold" />
            </div>
          ) : data.revenueByMonth.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              No revenue data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickLine={false}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip content={<CustomTooltip valuePrefix="$" />} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#c49d68"
                  strokeWidth={2}
                  dot={{ fill: '#c49d68', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: '#c49d68' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* User Growth Chart */}
      <Card className="rounded-2xl border border-gray-100 shadow-sm bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-dark-base flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-muted-teal" />
            User Signups
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[200px] flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-warm-gold" />
            </div>
          ) : data.usersByMonth.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              No user data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.usersByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="users" 
                  fill="#7a9e9f" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
