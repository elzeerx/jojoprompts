import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export interface TopPrompt {
  id: string;
  title: string;
  category: string;
  favoritesCount: number;
}

interface TopPromptsCardProps {
  prompts: TopPrompt[];
  loading: boolean;
}

const getCategoryColor = (category: string): string => {
  const lower = category?.toLowerCase() || '';
  if (lower.includes('chatgpt')) return 'bg-emerald-100 text-emerald-700';
  if (lower.includes('midjourney')) return 'bg-blue-100 text-blue-700';
  if (lower.includes('flux')) return 'bg-purple-100 text-purple-700';
  if (lower.includes('gemini')) return 'bg-amber-100 text-amber-700';
  if (lower.includes('sora')) return 'bg-rose-100 text-rose-700';
  return 'bg-gray-100 text-gray-700';
};

export function TopPromptsCard({ prompts, loading }: TopPromptsCardProps) {
  if (loading) {
    return (
      <Card className="rounded-2xl border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <TrendingUp className="h-5 w-5 text-warm-gold" />
            Top Performing Prompts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-5 w-12" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <TrendingUp className="h-5 w-5 text-warm-gold" />
          Top Performing Prompts
        </CardTitle>
      </CardHeader>
      <CardContent>
        {prompts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No prompts with favorites yet
          </p>
        ) : (
          <div className="space-y-3">
            {prompts.map((prompt, index) => (
              <div
                key={prompt.id}
                className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-sm font-medium text-muted-foreground w-5">
                    #{index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{prompt.title}</p>
                    <Badge 
                      variant="secondary" 
                      className={`text-xs mt-1 ${getCategoryColor(prompt.category)}`}
                    >
                      {prompt.category || 'General'}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-rose-500">
                  <Heart className="h-4 w-4 fill-current" />
                  <span className="text-sm font-medium">{prompt.favoritesCount}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
