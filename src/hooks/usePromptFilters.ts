import { useState, useMemo, useCallback, useEffect } from 'react';
import { useDebounce } from './useDebounce';
import { supabase } from '@/integrations/supabase/client';
import type { PromptFilters, PromptRow, PromptTypeFilter, SortOption } from '@/types/prompts';

const initialFilters: PromptFilters = {
  category: 'all',
  searchQuery: '',
  promptType: 'all',
  modelType: 'all',
  tags: [],
  sortBy: 'created_at',
  sortOrder: 'desc'
};

export function usePromptFilters() {
  const [filters, setFilters] = useState<PromptFilters>(initialFilters);
  const [categoryMappings, setCategoryMappings] = useState<Map<string, string[]>>(new Map());
  
  // Fetch category subcategory mappings on mount
  useEffect(() => {
    async function fetchMappings() {
      const { data: categories } = await supabase
        .from('categories')
        .select('name, subcategories')
        .eq('is_active', true);

      const mappings = new Map<string, string[]>();
      if (categories) {
        for (const cat of categories) {
          const subcats = (cat.subcategories as string[]) || [];
          // Include the category name itself (lowercase) plus all subcategories
          mappings.set(cat.name.toLowerCase(), [cat.name.toLowerCase(), ...subcats.map(s => s.toLowerCase())]);
        }
      }
      setCategoryMappings(mappings);
    }
    fetchMappings();
  }, []);
  
  // Debounce search query for better performance
  const debouncedSearchQuery = useDebounce(filters.searchQuery, 300);

  const updateFilter = useCallback(<K extends keyof PromptFilters>(
    key: K,
    value: PromptFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(prev => ({
      ...prev,
      category: 'all',
      searchQuery: '',
      promptType: 'all',
      modelType: 'all',
      tags: []
    }));
  }, []);

  // Filter function for client-side filtering
  const filterPrompts = useCallback((prompts: PromptRow[]) => {
    return prompts.filter(prompt => {
      // Category filter - use subcategory mappings
      if (filters.category !== 'all') {
        const promptCategory = (prompt.metadata?.category || '').toLowerCase();
        const filterCategoryKey = filters.category.toLowerCase();
        const subcategories = categoryMappings.get(filterCategoryKey);
        
        if (subcategories && subcategories.length > 0) {
          // Check if prompt category matches any of the subcategories
          const matches = subcategories.some(sub => promptCategory.includes(sub));
          if (!matches) {
            return false;
          }
        } else {
          // Fallback to partial matching
          if (!promptCategory.includes(filterCategoryKey)) {
            return false;
          }
        }
      }

      // Type filter
      if (filters.promptType !== 'all' && prompt.prompt_type !== filters.promptType) {
        return false;
      }

      // Model type filter - check metadata.model_type or prompt_type
      if (filters.modelType !== 'all') {
        const promptModelType = prompt.metadata?.model_type || prompt.prompt_type;
        if (promptModelType !== filters.modelType) {
          return false;
        }
      }

      // Search filter (use debounced value)
      if (debouncedSearchQuery) {
        const searchLower = debouncedSearchQuery.toLowerCase();
        const titleMatch = prompt.title.toLowerCase().includes(searchLower);
        const textMatch = prompt.prompt_text.toLowerCase().includes(searchLower);
        const categoryMatch = prompt.metadata?.category?.toLowerCase().includes(searchLower);
        const modelTypeMatch = prompt.metadata?.model_type?.toLowerCase().includes(searchLower);
        const tagsMatch = prompt.metadata?.tags?.some(tag => 
          tag.toLowerCase().includes(searchLower)
        );
        
        if (!titleMatch && !textMatch && !categoryMatch && !tagsMatch && !modelTypeMatch) {
          return false;
        }
      }

      // Tags filter
      if (filters.tags.length > 0) {
        const promptTags = prompt.metadata?.tags || [];
        const hasMatchingTag = filters.tags.some(tag => 
          promptTags.includes(tag)
        );
        if (!hasMatchingTag) {
          return false;
        }
      }

      return true;
    });
  }, [filters.category, filters.promptType, filters.modelType, debouncedSearchQuery, filters.tags, categoryMappings]);

  // Sort function
  const sortPrompts = useCallback((prompts: PromptRow[]) => {
    return [...prompts].sort((a, b) => {
      let aValue: any, bValue: any;

      switch (filters.sortBy) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'category':
          aValue = a.metadata?.category?.toLowerCase() || '';
          bValue = b.metadata?.category?.toLowerCase() || '';
          break;
        case 'created_at':
        default:
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
      }

      if (aValue < bValue) return filters.sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return filters.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filters.sortBy, filters.sortOrder]);

  // Combined filter and sort
  const processPrompts = useCallback((prompts: PromptRow[]) => {
    const filtered = filterPrompts(prompts);
    return sortPrompts(filtered);
  }, [filterPrompts, sortPrompts]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      filters.category !== 'all' ||
      filters.searchQuery !== '' ||
      filters.promptType !== 'all' ||
      filters.modelType !== 'all' ||
      filters.tags.length > 0
    );
  }, [filters]);

  return {
    filters,
    debouncedSearchQuery,
    updateFilter,
    resetFilters,
    clearFilters,
    processPrompts,
    hasActiveFilters,
    // Individual filter setters for convenience
    setCategory: (category: string) => updateFilter('category', category),
    setSearchQuery: (query: string) => updateFilter('searchQuery', query),
    setPromptType: (type: PromptTypeFilter) => updateFilter('promptType', type),
    setModelType: (modelType: string) => updateFilter('modelType', modelType),
    setTags: (tags: string[]) => updateFilter('tags', tags),
    setSortBy: (sortBy: SortOption) => updateFilter('sortBy', sortBy),
    setSortOrder: (order: 'asc' | 'desc') => updateFilter('sortOrder', order)
  };
}
