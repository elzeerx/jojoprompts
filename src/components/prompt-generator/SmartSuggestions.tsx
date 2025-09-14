import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Brain, Loader2, Plus } from "lucide-react";
import { useSmartSuggestions } from "@/pages/admin/components/prompts/hooks/useSmartSuggestions";
import { callEdgeFunction } from "@/utils/edgeFunctions";
import { useToast } from "@/hooks/use-toast";

interface SmartSuggestionsProps {
  promptText: string;
  currentCategory: string;
  currentType: string;
  onCategorySelect: (category: string) => void;
  onTypeSelect: (type: string) => void;
}

export function SmartSuggestions({
  promptText,
  currentCategory,
  currentType,
  onCategorySelect,
  onTypeSelect
}: SmartSuggestionsProps) {
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestedCategories, setSuggestedCategories] = useState<string[]>([]);
  const [suggestedTypes, setSuggestedTypes] = useState<string[]>([]);
  const { suggestions } = useSmartSuggestions(promptText, currentCategory);

  // Analyze prompt and suggest categories and types
  const analyzePrompt = useCallback(async () => {
    if (!promptText.trim() || promptText.length < 30) return;

    setIsAnalyzing(true);
    try {
      const response = await callEdgeFunction('generate-metadata', {
        prompt_text: promptText,
        category: currentCategory
      });

      if (response.metadata) {
        // Extract category suggestions based on content analysis
        const contentCategories = analyzeCategoriesFromContent(promptText);
        setSuggestedCategories(contentCategories);

        // Extract type suggestions based on content analysis
        const contentTypes = analyzeTypesFromContent(promptText);
        setSuggestedTypes(contentTypes);
      }
    } catch (error) {
      console.error("Error analyzing prompt:", error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [promptText, currentCategory]);

  // Auto-analyze when prompt text changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (promptText.trim().length > 30) {
        analyzePrompt();
      } else {
        setSuggestedCategories([]);
        setSuggestedTypes([]);
      }
    }, 1500); // 1.5 second debounce

    return () => clearTimeout(timer);
  }, [promptText, analyzePrompt]);

  if (!promptText.trim()) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground text-center">
            Start typing your prompt to get AI-powered suggestions for categories, types, and tags.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-warm-gold" />
        <span className="text-sm font-medium">AI Smart Suggestions</span>
        {isAnalyzing && (
          <Loader2 className="h-3 w-3 animate-spin text-warm-gold" />
        )}
      </div>

      {/* Suggested Categories */}
      {suggestedCategories.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-warm-gold" />
              Suggested Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {suggestedCategories.map((category, index) => (
                <Badge
                  key={index}
                  variant={category === currentCategory ? "default" : "outline"}
                  className="cursor-pointer hover:bg-warm-gold/20 hover:border-warm-gold transition-colors"
                  onClick={() => onCategorySelect(category)}
                >
                  {category !== currentCategory && <Plus className="h-3 w-3 mr-1" />}
                  {category}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Based on your prompt content analysis
            </p>
          </CardContent>
        </Card>
      )}

      {/* Suggested Types */}
      {suggestedTypes.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-warm-gold" />
              Suggested Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {suggestedTypes.map((type, index) => (
                <Badge
                  key={index}
                  variant={type === currentType ? "default" : "outline"}
                  className="cursor-pointer hover:bg-warm-gold/20 hover:border-warm-gold transition-colors"
                  onClick={() => onTypeSelect(type)}
                >
                  {type !== currentType && <Plus className="h-3 w-3 mr-1" />}
                  {type}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Based on prompt structure and content indicators
            </p>
          </CardContent>
        </Card>
      )}

      {promptText.trim().length > 0 && promptText.trim().length < 30 && (
        <p className="text-xs text-muted-foreground">
          Write more in your prompt (at least 30 characters) to get AI category and type suggestions.
        </p>
      )}
    </div>
  );
}

// Analyze content to suggest categories
function analyzeCategoriesFromContent(text: string): string[] {
  const categories: string[] = [];
  const lowerText = text.toLowerCase();

  // Content-based category detection
  if (lowerText.includes('image') || lowerText.includes('photo') || lowerText.includes('picture') || 
      lowerText.includes('visual') || lowerText.includes('painting') || lowerText.includes('artwork')) {
    categories.push('Midjourney prompt');
  }
  
  if (lowerText.includes('style') || lowerText.includes('artistic') || lowerText.includes('aesthetic')) {
    categories.push('Midjourney Style');
  }
  
  if (lowerText.includes('chatgpt') || lowerText.includes('chat') || lowerText.includes('conversation') ||
      lowerText.includes('assistant') || lowerText.includes('help') || lowerText.includes('explain')) {
    categories.push('ChatGPT text');
  }
  
  if (lowerText.includes('claude') || lowerText.includes('anthropic')) {
    categories.push('Claude text');
  }
  
  if (lowerText.includes('workflow') || lowerText.includes('automation') || lowerText.includes('n8n') ||
      lowerText.includes('process') || lowerText.includes('integration')) {
    categories.push('n8n workflow');
  }

  return [...new Set(categories)].slice(0, 3);
}

// Analyze content to suggest types
function analyzeTypesFromContent(text: string): string[] {
  const types: string[] = [];
  const lowerText = text.toLowerCase();

  // Type detection based on content patterns
  if (lowerText.includes('image') || lowerText.includes('photo') || lowerText.includes('visual') ||
      lowerText.includes('picture') || lowerText.includes('generate') && (lowerText.includes('image') || lowerText.includes('visual'))) {
    types.push('image');
  }
  
  if (lowerText.includes('workflow') || lowerText.includes('automation') || lowerText.includes('process')) {
    types.push('workflow');
  }
  
  if (lowerText.includes('json') || lowerText.includes('{') || lowerText.includes('}') ||
      lowerText.includes('api') || lowerText.includes('data structure')) {
    types.push('json');
  }
  
  if (lowerText.includes('video') || lowerText.includes('animation') || lowerText.includes('motion')) {
    types.push('video');
  }
  
  if (lowerText.includes('audio') || lowerText.includes('sound') || lowerText.includes('music')) {
    types.push('audio');
  }

  // Default to text if no specific type detected
  if (types.length === 0) {
    types.push('text');
  }

  return [...new Set(types)].slice(0, 3);
}