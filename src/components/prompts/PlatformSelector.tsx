import React, { useState, useMemo } from 'react';
import { Platform } from '@/types/platform';
import { usePlatforms } from '@/hooks/usePlatforms';
import { PlatformCard } from './PlatformCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PlatformSelectorProps {
  onSelect: (platform: Platform) => void;
  selectedPlatformId?: string;
  className?: string;
  showSearch?: boolean;
  showCategoryTabs?: boolean;
}

export function PlatformSelector({
  onSelect,
  selectedPlatformId,
  className,
  showSearch = true,
  showCategoryTabs = true
}: PlatformSelectorProps) {
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  const { data: platforms, isLoading: loading, error } = usePlatforms();

  // Get unique categories
  const categories = useMemo(() => {
    if (!platforms) return [];
    const uniqueCategories = [...new Set(platforms.map(p => p.category))];
    return ['all', ...uniqueCategories];
  }, [platforms]);

  // Filter platforms based on search and category
  const filteredPlatforms = useMemo(() => {
    if (!platforms) return [];

    let filtered = platforms;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [platforms, selectedCategory, searchQuery]);

  // Category display names
  const categoryLabels: Record<string, string> = {
    'all': 'All Platforms',
    'text-to-text': 'Text to Text',
    'text-to-image': 'Text to Image',
    'text-to-video': 'Text to Video',
    'workflow': 'Workflows',
    'other': 'Other'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        <p>Error loading platforms: {error.message}</p>
      </div>
    );
  }

  if (!platforms || platforms.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No platforms available</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4 sm:space-y-6", className)}>
      {/* Search Bar */}
      {showSearch && (
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search platforms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 w-full mobile-optimize-rendering"
          />
        </div>
      )}

      {/* Category Tabs */}
      {showCategoryTabs ? (
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="w-full justify-start overflow-x-auto flex-nowrap scrollbar-hide">
            {categories.map(category => (
              <TabsTrigger 
                key={category as string} 
                value={category as string} 
                className="flex-shrink-0 text-xs sm:text-sm whitespace-nowrap"
              >
                {categoryLabels[category as string] || category}
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map(category => (
            <TabsContent key={category as string} value={category as string} className="mt-4 sm:mt-6 animate-fade-in">
              {/* Platform Grid */}
              {filteredPlatforms.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {filteredPlatforms.map(platform => (
                    <PlatformCard
                      key={platform.id}
                      platform={platform}
                      isSelected={platform.id === selectedPlatformId}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 space-y-4 animate-fade-in">
                  <div className="text-4xl">🔍</div>
                  <div className="space-y-2">
                    <p className="text-base font-medium text-foreground">No platforms found</p>
                    <p className="text-sm text-muted-foreground">
                      {searchQuery ? (
                        <>No results for "{searchQuery}"</>
                      ) : (
                        <>No platforms available in this category</>
                      )}
                    </p>
                  </div>
                  {searchQuery && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSearchQuery('')}
                      className="mt-4"
                    >
                      Clear search
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        // Simple grid without tabs
        <div className="animate-fade-in">
          {filteredPlatforms.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {filteredPlatforms.map(platform => (
                <PlatformCard
                  key={platform.id}
                  platform={platform}
                  isSelected={platform.id === selectedPlatformId}
                  onSelect={onSelect}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 space-y-4">
              <div className="text-4xl">🔍</div>
              <div className="space-y-2">
                <p className="text-base font-medium text-foreground">No platforms found</p>
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? (
                    <>No results for "{searchQuery}"</>
                  ) : (
                    <>No platforms are currently available</>
                  )}
                </p>
              </div>
              {searchQuery && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSearchQuery('')}
                  className="mt-4"
                >
                  Clear search
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Results count */}
      {filteredPlatforms.length > 0 && (
        <div className="text-xs sm:text-sm text-muted-foreground text-center pt-2 border-t">
          Showing {filteredPlatforms.length} of {platforms.length} platform{platforms.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
