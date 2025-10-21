import { useState, useMemo, useCallback } from 'react';
import { useDebounce } from './useDebounce';
import type { PromptFilters, PromptRow, PromptTypeFilter, SortOption } from '@/types/prompts';

const initialFilters: PromptFilters = {
  category: 'all',
  searchQuery: '',
  promptType: 'all',
  tags: [],
  sortBy: 'created_at',
  sortOrder: 'desc'
};

export function usePromptFilters() {
  const [filters, setFilters] = useState<PromptFilters>(initialFilters);
  
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
      tags: []
    }));
  }, []);

  // Filter function for client-side filtering
  const filterPrompts = useCallback((prompts: PromptRow[]) => {
    return prompts.filter(prompt => {
      // Category filter
      if (filters.category !== 'all' && prompt.metadata?.category !== filters.category) {
        return false;
      }

      // Type filter
      if (filters.promptType !== 'all' && prompt.prompt_type !== filters.promptType) {
        return false;
      }

      // Search filter (use debounced value)
      if (debouncedSearchQuery) {
        const searchLower = debouncedSearchQuery.toLowerCase();
        const titleMatch = prompt.title.toLowerCase().includes(searchLower);
        const textMatch = prompt.prompt_text.toLowerCase().includes(searchLower);
        const categoryMatch = prompt.metadata?.category?.toLowerCase().includes(searchLower);
        const tagsMatch = prompt.metadata?.tags?.some(tag => 
          tag.toLowerCase().includes(searchLower)
        );
        
        if (!titleMatch && !textMatch && !categoryMatch && !tagsMatch) {
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
  }, [filters.category, filters.promptType, debouncedSearchQuery, filters.tags]);

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
    setTags: (tags: string[]) => updateFilter('tags', tags),
    setSortBy: (sortBy: SortOption) => updateFilter('sortBy', sortBy),
    setSortOrder: (order: 'asc' | 'desc') => updateFilter('sortOrder', order)
  };
}