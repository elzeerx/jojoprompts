
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Filter, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

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
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="relative">
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Filters</h4>
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            {/* Prompt Types */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Prompt Types</Label>
              <div className="space-y-2">
                {promptTypes.map((type) => (
                  <div key={type.id} className="flex items-center space-x-2">
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
                    />
                    <Label htmlFor={type.id} className="text-sm">{type.label}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Categories */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Categories</Label>
              <div className="space-y-2">
                {categories.map((category) => (
                  <div key={category.id} className="flex items-center space-x-2">
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
                    />
                    <Label htmlFor={category.id} className="text-sm">{category.label}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Premium Filter */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Access Level</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="free"
                    checked={filters.isPremium === false}
                    onCheckedChange={(checked) => {
                      handleFilterChange('isPremium', checked ? false : null);
                    }}
                  />
                  <Label htmlFor="free" className="text-sm">Free</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="premium"
                    checked={filters.isPremium === true}
                    onCheckedChange={(checked) => {
                      handleFilterChange('isPremium', checked ? true : null);
                    }}
                  />
                  <Label htmlFor="premium" className="text-sm">Premium</Label>
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
