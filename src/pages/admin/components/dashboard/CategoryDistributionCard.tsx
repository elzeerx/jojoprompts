import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { LayoutGrid } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export interface CategoryData {
  name: string;
  count: number;
  color: string;
}

interface CategoryDistributionCardProps {
  categories: CategoryData[];
  loading: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  chatgpt: '#10b981',     // emerald
  midjourney: '#3b82f6',  // blue
  flux: '#8b5cf6',        // purple
  gemini: '#f59e0b',      // amber
  sora: '#f43f5e',        // rose
  elevenlabs: '#06b6d4',  // cyan
  cursor: '#6366f1',      // indigo
  other: '#6b7280',       // gray
};

export function CategoryDistributionCard({ categories, loading }: CategoryDistributionCardProps) {
  const total = categories.reduce((sum, cat) => sum + cat.count, 0);

  if (loading) {
    return (
      <Card className="rounded-2xl border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <LayoutGrid className="h-5 w-5 text-warm-gold" />
            Category Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px]">
            <Skeleton className="h-32 w-32 rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Filter out categories with 0 count for better visualization
  const filteredCategories = categories.filter(cat => cat.count > 0);

  return (
    <Card className="rounded-2xl border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <LayoutGrid className="h-5 w-5 text-warm-gold" />
          Category Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        {filteredCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No prompts categorized yet
          </p>
        ) : (
          <>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={filteredCategories}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="name"
                  >
                    {filteredCategories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      `${value} (${((value / total) * 100).toFixed(0)}%)`,
                      name
                    ]}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Legend as progress bars */}
            <div className="space-y-2 mt-4">
              {filteredCategories.slice(0, 5).map((category) => (
                <div key={category.name} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="text-xs text-muted-foreground flex-1 capitalize">
                    {category.name}
                  </span>
                  <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all"
                      style={{ 
                        width: `${(category.count / total) * 100}%`,
                        backgroundColor: category.color 
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium w-8 text-right">
                    {category.count}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export { CATEGORY_COLORS };
