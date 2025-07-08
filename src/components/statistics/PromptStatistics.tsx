import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Heart, Share, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface PromptStats {
  total_prompts: number;
  total_views: number;
  total_favorites: number;
  total_shares: number;
  category_breakdown: { category: string; count: number }[];
  recent_activity: { action: string; count: number; date: string }[];
}

interface PrompterStats extends PromptStats {
  uploader_breakdown: { uploader_name: string; count: number }[];
}

interface PromptStatisticsProps {
  userId?: string; // If provided, shows stats for specific user only
  isAdminView?: boolean; // If true, shows admin-level stats
}

export function PromptStatistics({ userId, isAdminView = false }: PromptStatisticsProps) {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState<PromptStats | PrompterStats | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedUploader, setSelectedUploader] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (!targetUserId) return;
    fetchStats();
  }, [targetUserId, selectedCategory, selectedUploader]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Base query for prompts
      let promptsQuery = supabase
        .from("prompts")
        .select(`
          id,
          metadata,
          user_id
        `);

      // Apply filters based on view type
      if (!isAdminView && targetUserId) {
        promptsQuery = promptsQuery.eq('user_id', targetUserId);
      }

      if (selectedCategory !== "all") {
        promptsQuery = promptsQuery.contains('metadata', { category: selectedCategory });
      }

      if (selectedUploader !== "all" && isAdminView) {
        promptsQuery = promptsQuery.eq('user_id', selectedUploader);
      }

      const { data: prompts, error: promptsError } = await promptsQuery;

      if (promptsError) throw promptsError;

      // Get user profiles for the uploaders
      const userIds = [...new Set(prompts?.map(p => p.user_id) || [])];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Get usage statistics
      let usageQuery = supabase
        .from("prompt_usage_history")
        .select("action_type, prompt_id, created_at");

      if (!isAdminView && targetUserId) {
        // Get stats for user's prompts only
        const userPromptIds = prompts?.map(p => p.id) || [];
        if (userPromptIds.length > 0) {
          usageQuery = usageQuery.in('prompt_id', userPromptIds);
        }
      }

      const { data: usageData, error: usageError } = await usageQuery;
      if (usageError) throw usageError;

      // Get favorites data
      let favoritesQuery = supabase
        .from("favorites")
        .select("prompt_id");

      if (!isAdminView && targetUserId) {
        const userPromptIds = prompts?.map(p => p.id) || [];
        if (userPromptIds.length > 0) {
          favoritesQuery = favoritesQuery.in('prompt_id', userPromptIds);
        }
      }

      const { data: favoritesData, error: favoritesError } = await favoritesQuery;
      if (favoritesError) throw favoritesError;

      // Get shares data
      let sharesQuery = supabase
        .from("prompt_shares")
        .select("prompt_id");

      if (!isAdminView && targetUserId) {
        const userPromptIds = prompts?.map(p => p.id) || [];
        if (userPromptIds.length > 0) {
          sharesQuery = sharesQuery.in('prompt_id', userPromptIds);
        }
      }

      const { data: sharesData, error: sharesError } = await sharesQuery;
      if (sharesError) throw sharesError;

      // Calculate statistics
      const totalPrompts = prompts?.length || 0;
      const totalViews = usageData?.filter(u => u.action_type === 'view').length || 0;
      const totalFavorites = favoritesData?.length || 0;
      const totalShares = sharesData?.length || 0;

      // Category breakdown
      const categoryMap = new Map<string, number>();
      prompts?.forEach(prompt => {
        const metadata = prompt.metadata as any;
        const category = metadata?.category || 'Uncategorized';
        categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
      });

      const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, count]) => ({
        category,
        count
      }));

      // Recent activity (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recentActivity = usageData
        ?.filter(u => new Date(u.created_at) >= sevenDaysAgo)
        .reduce((acc, curr) => {
          const existing = acc.find(a => a.action === curr.action_type);
          if (existing) {
            existing.count++;
          } else {
            acc.push({ action: curr.action_type, count: 1, date: curr.created_at });
          }
          return acc;
        }, [] as { action: string; count: number; date: string }[]) || [];

      let calculatedStats: PromptStats | PrompterStats = {
        total_prompts: totalPrompts,
        total_views: totalViews,
        total_favorites: totalFavorites,
        total_shares: totalShares,
        category_breakdown: categoryBreakdown,
        recent_activity: recentActivity,
      };

      // Add uploader breakdown for admin view
      if (isAdminView && isAdmin) {
        const uploaderMap = new Map<string, number>();
        prompts?.forEach(prompt => {
          const profile = profiles?.find(p => p.id === prompt.user_id);
          const uploaderName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Unknown User';
          uploaderMap.set(uploaderName, (uploaderMap.get(uploaderName) || 0) + 1);
        });

        const uploaderBreakdown = Array.from(uploaderMap.entries()).map(([uploader_name, count]) => ({
          uploader_name,
          count
        }));

        (calculatedStats as PrompterStats).uploader_breakdown = uploaderBreakdown;
      }

      setStats(calculatedStats);
    } catch (error) {
      console.error("Error fetching prompt statistics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-8 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Filters */}
      {isAdminView && (
        <div className="flex gap-4 mb-6">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {stats.category_breakdown.map(cat => (
                <SelectItem key={cat.category} value={cat.category}>
                  {cat.category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {'uploader_breakdown' in stats && (
            <Select value={selectedUploader} onValueChange={setSelectedUploader}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by uploader" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Uploaders</SelectItem>
                {stats.uploader_breakdown.map(uploader => (
                  <SelectItem key={uploader.uploader_name} value={uploader.uploader_name}>
                    {uploader.uploader_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Prompts</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_prompts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_views}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Favorites</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_favorites}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Shares</CardTitle>
            <Share className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_shares}</div>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.category_breakdown.map(item => (
              <div key={item.category} className="flex justify-between items-center">
                <span className="text-sm font-medium">{item.category}</span>
                <span className="text-sm text-muted-foreground">{item.count} prompts</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Uploader Breakdown (Admin only) */}
      {'uploader_breakdown' in stats && (
        <Card>
          <CardHeader>
            <CardTitle>Uploader Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.uploader_breakdown.map(item => (
                <div key={item.uploader_name} className="flex justify-between items-center">
                  <span className="text-sm font-medium">{item.uploader_name}</span>
                  <span className="text-sm text-muted-foreground">{item.count} prompts</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.recent_activity.length > 0 ? (
              stats.recent_activity.map((activity, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-sm font-medium capitalize">{activity.action}</span>
                  <span className="text-sm text-muted-foreground">{activity.count} times</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}