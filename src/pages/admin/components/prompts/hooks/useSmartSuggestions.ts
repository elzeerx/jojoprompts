import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type PromptRow } from "@/types";

interface SmartSuggestions {
  tags: string[];
  styles: string[];
  useCases: string[];
}

export function useSmartSuggestions(promptText: string, category: string) {
  const [promptMetadata, setPromptMetadata] = useState<Array<{ metadata: any }>>([]);
  const [loading, setLoading] = useState(false);

  // Fetch prompts on mount
  useEffect(() => {
    const fetchPrompts = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("prompts")
          .select("metadata")
          .limit(200); // Limit to avoid performance issues

        if (error) throw error;
        setPromptMetadata(data || []);
      } catch (error) {
        console.error("Error fetching prompts for suggestions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPrompts();
  }, []);

  // Generate smart suggestions based on prompt text and existing data
  const suggestions = useMemo((): SmartSuggestions => {
    if (!promptMetadata.length) {
      return {
        tags: getDefaultTags(category),
        styles: getDefaultStyles(category),
        useCases: getDefaultUseCases(category)
      };
    }

    // Extract all tags, styles, and use cases from existing prompts
    const allTags = new Map<string, number>();
    const allStyles = new Map<string, number>();
    const allUseCases = new Map<string, number>();

    promptMetadata.forEach(prompt => {
      const metadata = prompt.metadata;
      
      // Count tags
      if (metadata?.tags && Array.isArray(metadata.tags)) {
        metadata.tags.forEach(tag => {
          const normalizedTag = tag.toLowerCase().trim();
          allTags.set(normalizedTag, (allTags.get(normalizedTag) || 0) + 1);
        });
      }

      // Count styles
      if (metadata?.style) {
        const normalizedStyle = metadata.style.toLowerCase().trim();
        allStyles.set(normalizedStyle, (allStyles.get(normalizedStyle) || 0) + 1);
      }

      // Count use cases
      if (metadata?.use_case) {
        const normalizedUseCase = metadata.use_case.toLowerCase().trim();
        allUseCases.set(normalizedUseCase, (allUseCases.get(normalizedUseCase) || 0) + 1);
      }
    });

    // Sort by frequency and get top suggestions
    const topTags = Array.from(allTags.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([tag]) => tag);

    const topStyles = Array.from(allStyles.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([style]) => style);

    const topUseCases = Array.from(allUseCases.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([useCase]) => useCase);

    // Add keyword-based suggestions from prompt text
    const keywordTags = extractKeywordTags(promptText);
    const combinedTags = [...new Set([...keywordTags, ...topTags])].slice(0, 12);

    return {
      tags: combinedTags,
      styles: topStyles.length ? topStyles : getDefaultStyles(category),
      useCases: topUseCases.length ? topUseCases : getDefaultUseCases(category)
    };
  }, [promptMetadata, promptText, category]);

  return { suggestions, loading };
}

// Extract potential tags from prompt text
function extractKeywordTags(text: string): string[] {
  if (!text) return [];
  
  const keywords = text.toLowerCase().match(/\b\w{3,}\b/g) || [];
  const relevantKeywords = keywords.filter(word => 
    !['the', 'and', 'for', 'with', 'this', 'that', 'from', 'they', 'have', 'will', 'you', 'are', 'can', 'not'].includes(word)
  );
  
  return [...new Set(relevantKeywords)].slice(0, 5);
}

// Default suggestions by category
function getDefaultTags(category: string): string[] {
  const defaults = {
    'chatgpt': ['creative', 'professional', 'educational', 'business', 'marketing', 'writing'],
    'midjourney': ['artistic', 'realistic', 'fantasy', 'portrait', 'landscape', 'abstract'],
    'workflow': ['automation', 'productivity', 'integration', 'data', 'api', 'process'],
    'n8n': ['automation', 'workflow', 'integration', 'api', 'data-processing', 'trigger']
  };
  
  return defaults[category.toLowerCase()] || defaults['chatgpt'];
}

function getDefaultStyles(category: string): string[] {
  const defaults = {
    'chatgpt': ['conversational', 'professional', 'creative', 'analytical'],
    'midjourney': ['photorealistic', 'artistic', 'minimalist', 'dramatic', 'cinematic'],
    'workflow': ['efficient', 'robust', 'scalable', 'modular'],
    'n8n': ['automated', 'streamlined', 'efficient', 'modular']
  };
  
  return defaults[category.toLowerCase()] || defaults['chatgpt'];
}

function getDefaultUseCases(category: string): string[] {
  const defaults = {
    'chatgpt': ['content creation', 'problem solving', 'learning', 'brainstorming'],
    'midjourney': ['concept art', 'illustrations', 'marketing visuals', 'personal projects'],
    'workflow': ['data processing', 'task automation', 'system integration'],
    'n8n': ['workflow automation', 'data synchronization', 'notification systems']
  };
  
  return defaults[category.toLowerCase()] || defaults['chatgpt'];
}