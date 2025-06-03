
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Filter, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useIsMobile, useIsSmallMobile } from '@/hooks/use-mobile';

interface SearchFilters {
  promptTypes: string[];
  categories: string[];
  isPremium: boolean | null;
}

interface GlobalSearchProps {
  onSearch: (query: string, filters: SearchFilters) => void;
  placeholder?: string;
  className?: string;
}

const promptTypes = [
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'midjourney', label: 'Midjourney' },
  { id: 'workflow', label: 'Workflow' }
];

const categories = [
  { id: 'business', label: 'Business' },
  { id: 'creative', label: 'Creative' },
  { id: 'education', label: 'Education' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'development', label: 'Development' }
];

export function GlobalSearch({ onSearch, placeholder = "Search prompts...", className }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({
    promptTypes: [],
    categories: [],
    isPremium: null
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const isMobile = useIsMobile();
  const isSmallMobile = useIsSmallMobile();

  const activeFiltersCount = filters.promptTypes.length + filters.categories.length + (filters.isPremium !== null ? 1 : 0);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      onSearch(query, filters);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [query, filters, onSearch]);

  const handleFilterChange = (type: keyof SearchFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [type]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      promptTypes: [],
      categories: [],
      isPremium: null
    });
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 z-10" />
        <Input
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`pl-10 border-warm-gold/20 rounded-lg mobile-optimize-rendering transition-shadow focus:shadow-md ${
            isSmallMobile ? 'text-base' : ''
          }`}
          // Mobile keyboard optimization
          inputMode="search"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
        />
      </div>

      <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            className={`relative touch-manipulation border-warm-gold/20 mobile-optimize-rendering transition-all hover:shadow-md ${
              isSmallMobile ? 'min-h-[44px] px-3' : 'min-h-[44px]'
            }`}
          >
            <Filter className="h-4 w-4 mr-2" />
            {!isSmallMobile && 'Filters'}
            {activeFiltersCount > 0 && (
              <Badge 
                variant="secondary" 
                className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs bg-warm-gold text-white"
              >
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className={`bg-white border border-warm-gold/20 shadow-lg mobile-optimize-rendering ${
            isMobile ? 'w-[95vw] max-w-sm' : 'w-80'
          }`}
          align="end"
          sideOffset={8}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-dark-base">Filters</h4>
              {activeFiltersCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearFilters}
                  className="touch-manipulation text-warm-gold hover:text-warm-gold/80 min-h-[36px]"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            {/* Mobile-optimized sections */}
            <div className="space-y-4">
              {/* Prompt Types */}
              <div>
                <Label className={`font-medium mb-3 block text-dark-base ${
                  isSmallMobile ? 'text-sm' : 'text-sm'
                }`}>
                  Prompt Types
                </Label>
                <div className="space-y-3">
                  {promptTypes.map((type) => (
                    <div key={type.id} className="flex items-center space-x-3 touch-manipulation">
                      <Checkbox
                        id={type.id}
                        checked={filters.promptTypes.includes(type.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            handleFilterChange('promptTypes', [...filters.promptTypes, type.id]);
                          } else {
                            handleFilterChange('promptTypes', filters.promptTypes.filter(t => t !== type.id));
                          }
                        }}
                        className="border-warm-gold/30 data-[state=checked]:bg-warm-gold data-[state=checked]:border-warm-gold min-h-[20px] min-w-[20px]"
                      />
                      <Label 
                        htmlFor={type.id} 
                        className={`text-dark-base cursor-pointer flex-1 touch-manipulation min-h-[36px] flex items-center ${
                          isSmallMobile ? 'text-sm' : 'text-sm'
                        }`}
                      >
                        {type.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Categories */}
              <div>
                <Label className={`font-medium mb-3 block text-dark-base ${
                  isSmallMobile ? 'text-sm' : 'text-sm'
                }`}>
                  Categories
                </Label>
                <div className="space-y-3">
                  {categories.map((category) => (
                    <div key={category.id} className="flex items-center space-x-3 touch-manipulation">
                      <Checkbox
                        id={category.id}
                        checked={filters.categories.includes(category.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            handleFilterChange('categories', [...filters.categories, category.id]);
                          } else {
                            handleFilterChange('categories', filters.categories.filter(c => c !== category.id));
                          }
                        }}
                        className="border-warm-gold/30 data-[state=checked]:bg-warm-gold data-[state=checked]:border-warm-gold min-h-[20px] min-w-[20px]"
                      />
                      <Label 
                        htmlFor={category.id} 
                        className={`text-dark-base cursor-pointer flex-1 touch-manipulation min-h-[36px] flex items-center ${
                          isSmallMobile ? 'text-sm' : 'text-sm'
                        }`}
                      >
                        {category.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Premium Filter */}
              <div>
                <Label className={`font-medium mb-3 block text-dark-base ${
                  isSmallMobile ? 'text-sm' : 'text-sm'
                }`}>
                  Access Level
                </Label>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 touch-manipulation">
                    <Checkbox
                      id="free"
                      checked={filters.isPremium === false}
                      onCheckedChange={(checked) => {
                        handleFilterChange('isPremium', checked ? false : null);
                      }}
                      className="border-warm-gold/30 data-[state=checked]:bg-warm-gold data-[state=checked]:border-warm-gold min-h-[20px] min-w-[20px]"
                    />
                    <Label 
                      htmlFor="free" 
                      className={`text-dark-base cursor-pointer flex-1 touch-manipulation min-h-[36px] flex items-center ${
                        isSmallMobile ? 'text-sm' : 'text-sm'
                      }`}
                    >
                      Free
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 touch-manipulation">
                    <Checkbox
                      id="premium"
                      checked={filters.isPremium === true}
                      onCheckedChange={(checked) => {
                        handleFilterChange('isPremium', checked ? true : null);
                      }}
                      className="border-warm-gold/30 data-[state=checked]:bg-warm-gold data-[state=checked]:border-warm-gold min-h-[20px] min-w-[20px]"
                    />
                    <Label 
                      htmlFor="premium" 
                      className={`text-dark-base cursor-pointer flex-1 touch-manipulation min-h-[36px] flex items-center ${
                        isSmallMobile ? 'text-sm' : 'text-sm'
                      }`}
                    >
                      Premium
                    </Label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
