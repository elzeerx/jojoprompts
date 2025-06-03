
import React, { useState, useEffect } from 'react';
import { GlobalSearch } from '@/components/search/GlobalSearch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { PromptCard } from '@/components/ui/prompt-card';
import { Loader2 } from 'lucide-react';
import { type PromptRow } from '@/types';
import { useIsMobile, useIsSmallMobile } from '@/hooks/use-mobile';

interface SearchFilters {
  promptTypes: string[];
  categories: string[];
  isPremium: boolean | null;
}

export default function SearchPage() {
  const [searchResults, setSearchResults] = useState<PromptRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentQuery, setCurrentQuery] = useState('');
  const [currentFilters, setCurrentFilters] = useState<SearchFilters>({
    promptTypes: [],
    categories: [],
    isPremium: null
  });
  const isMobile = useIsMobile();
  const isSmallMobile = useIsSmallMobile();

  const handleSearch = async (query: string, filters: SearchFilters) => {
    setCurrentQuery(query);
    setCurrentFilters(filters);

    if (!query.trim() && filters.promptTypes.length === 0 && filters.categories.length === 0 && filters.isPremium === null) {
      setSearchResults([]);
      return;
    }

    setLoading(true);

    try {
      let supabaseQuery = supabase
        .from('prompts')
        .select('*');

      // Add text search
      if (query.trim()) {
        supabaseQuery = supabaseQuery.or(`title.ilike.%${query}%,prompt_text.ilike.%${query}%`);
      }

      // Add prompt type filter
      if (filters.promptTypes.length > 0) {
        supabaseQuery = supabaseQuery.in('prompt_type', filters.promptTypes);
      }

      // Add premium filter (this would need to be implemented based on your premium logic)
      // For now, we'll skip this filter since it's not in the current schema

      const { data, error } = await supabaseQuery
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Cast the data to PromptRow type to handle the metadata Json type
      const promptRows: PromptRow[] = (data || []).map(item => ({
        ...item,
        metadata: item.metadata || {},
        created_at: item.created_at || null
      } as PromptRow));

      setSearchResults(promptRows);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const getResultsText = () => {
    if (!currentQuery && currentFilters.promptTypes.length === 0 && currentFilters.categories.length === 0) {
      return "Start typing to search prompts...";
    }
    
    if (loading) {
      return "Searching...";
    }

    return `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''} found`;
  };

  return (
    <div className="min-h-screen bg-soft-bg/30">
      <Container className="py-4 sm:py-6 lg:py-8">
        {/* Mobile-optimized header */}
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <h1 className={`font-bold mb-2 sm:mb-4 ${
            isSmallMobile ? 'text-xl' : 'text-2xl sm:text-3xl'
          }`}>
            Search Prompts
          </h1>
          <p className={`text-muted-foreground mb-4 sm:mb-6 ${
            isSmallMobile ? 'text-sm' : 'text-base'
          }`}>
            Find the perfect prompt from our extensive collection
          </p>
          
          {/* Mobile-optimized search component */}
          <GlobalSearch 
            onSearch={handleSearch} 
            className={isMobile ? "w-full" : "max-w-2xl"} 
          />
        </div>

        {/* Mobile-optimized active filters display */}
        {(currentFilters.promptTypes.length > 0 || currentFilters.categories.length > 0 || currentFilters.isPremium !== null) && (
          <div className="mb-4 sm:mb-6">
            <div className="flex flex-wrap gap-1 sm:gap-2">
              <span className={`text-muted-foreground ${
                isSmallMobile ? 'text-xs' : 'text-sm'
              }`}>
                Active filters:
              </span>
              {currentFilters.promptTypes.map(type => (
                <Badge key={type} variant="secondary" className={isSmallMobile ? 'text-xs px-2 py-0.5' : ''}>
                  Type: {type}
                </Badge>
              ))}
              {currentFilters.categories.map(category => (
                <Badge key={category} variant="secondary" className={isSmallMobile ? 'text-xs px-2 py-0.5' : ''}>
                  Category: {category}
                </Badge>
              ))}
              {currentFilters.isPremium !== null && (
                <Badge variant="secondary" className={isSmallMobile ? 'text-xs px-2 py-0.5' : ''}>
                  {currentFilters.isPremium ? 'Premium' : 'Free'}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Mobile-optimized results card */}
        <Card className="mobile-optimize-rendering">
          <CardHeader className={isSmallMobile ? 'p-3 sm:p-4' : ''}>
            <CardTitle className={isSmallMobile ? 'text-lg' : ''}>Search Results</CardTitle>
            <CardDescription className={isSmallMobile ? 'text-sm' : ''}>
              {getResultsText()}
            </CardDescription>
          </CardHeader>
          <CardContent className={isSmallMobile ? 'p-3 sm:p-4' : ''}>
            {loading ? (
              <div className="flex items-center justify-center py-8 sm:py-12">
                <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-muted-foreground" />
              </div>
            ) : searchResults.length > 0 ? (
              <div className={`grid gap-3 sm:gap-4 lg:gap-6 ${
                isSmallMobile 
                  ? 'grid-cols-1' 
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              }`}>
                {searchResults.map((prompt) => (
                  <PromptCard
                    key={prompt.id}
                    prompt={prompt}
                    onDelete={() => {
                      // Refresh search results after deletion
                      handleSearch(currentQuery, currentFilters);
                    }}
                  />
                ))}
              </div>
            ) : currentQuery || currentFilters.promptTypes.length > 0 || currentFilters.categories.length > 0 ? (
              <div className="text-center py-8 sm:py-12">
                <p className={`text-muted-foreground ${isSmallMobile ? 'text-sm' : ''}`}>
                  No prompts found matching your search criteria.
                </p>
              </div>
            ) : (
              <div className="text-center py-8 sm:py-12">
                <p className={`text-muted-foreground ${isSmallMobile ? 'text-sm' : ''}`}>
                  Enter a search query or apply filters to find prompts.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </Container>
    </div>
  );
}
