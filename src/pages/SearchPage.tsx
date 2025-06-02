
import React, { useState, useEffect } from 'react';
import { GlobalSearch } from '@/components/search/GlobalSearch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { PromptCard } from '@/components/ui/prompt-card';
import { Loader2 } from 'lucide-react';

interface SearchFilters {
  promptTypes: string[];
  categories: string[];
  isPremium: boolean | null;
}

interface Prompt {
  id: string;
  title: string;
  prompt_text: string;
  prompt_type: string;
  image_path: string | null;
  default_image_path: string | null;
  metadata: any;
  user_id: string;
  created_at: string;
}

export default function SearchPage() {
  const [searchResults, setSearchResults] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentQuery, setCurrentQuery] = useState('');
  const [currentFilters, setCurrentFilters] = useState<SearchFilters>({
    promptTypes: [],
    categories: [],
    isPremium: null
  });

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

      setSearchResults(data || []);
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
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Search Prompts</h1>
        <p className="text-muted-foreground mb-6">
          Find the perfect prompt from our extensive collection
        </p>
        
        <GlobalSearch onSearch={handleSearch} className="max-w-2xl" />
      </div>

      {/* Active Filters Display */}
      {(currentFilters.promptTypes.length > 0 || currentFilters.categories.length > 0 || currentFilters.isPremium !== null) && (
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground">Active filters:</span>
            {currentFilters.promptTypes.map(type => (
              <Badge key={type} variant="secondary">
                Type: {type}
              </Badge>
            ))}
            {currentFilters.categories.map(category => (
              <Badge key={category} variant="secondary">
                Category: {category}
              </Badge>
            ))}
            {currentFilters.isPremium !== null && (
              <Badge variant="secondary">
                {currentFilters.isPremium ? 'Premium' : 'Free'}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>Search Results</CardTitle>
          <CardDescription>
            {getResultsText()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : searchResults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No prompts found matching your search criteria.
              </p>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                Enter a search query or apply filters to find prompts.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
