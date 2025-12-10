import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, X, Plus, Loader2, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { callEdgeFunction } from "@/utils/edgeFunctions";
import { createLogger } from '@/utils/logging';

const logger = createLogger('TAGS_MANAGER');

interface TagsManagerProps {
  promptText: string;
  tags: string[];
  onChange: (tags: string[]) => void;
}

export function TagsManager({ promptText, tags, onChange }: TagsManagerProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);

  // Debounced AI tag generation
  const generateTags = useCallback(async () => {
    if (!promptText.trim() || promptText.length < 20) return;

    setIsGenerating(true);
    try {
      // Use existing metadata generation function
      const response = await callEdgeFunction('generate-metadata', {
        prompt_text: promptText,
        category: "general" // Default category for tag generation
      });

      if (response.metadata?.tags && Array.isArray(response.metadata.tags)) {
        const aiTags = response.metadata.tags.filter((tag: string) => 
          tag && typeof tag === 'string' && !tags.includes(tag.toLowerCase())
        );
        setSuggestedTags(aiTags.slice(0, 8)); // Limit to 8 suggestions
      }
    } catch (error: any) {
      logger.error('Error generating tags', { error: error.message });
      // Fallback: Extract basic keywords from prompt
      const words = promptText.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3 && word.length < 15)
        .slice(0, 6);
      setSuggestedTags(words);
    } finally {
      setIsGenerating(false);
    }
  }, [promptText, tags]);

  // Auto-generate tags when prompt text changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (promptText.trim().length > 20) {
        generateTags();
      } else {
        setSuggestedTags([]);
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timer);
  }, [promptText, generateTags]);

  const addTag = (tagText: string) => {
    const cleanTag = tagText.trim().toLowerCase();
    if (!cleanTag || tags.includes(cleanTag)) return;

    onChange([...tags, cleanTag]);
    setNewTag("");
    
    // Remove from suggestions
    setSuggestedTags(prev => prev.filter(tag => tag.toLowerCase() !== cleanTag));
  };

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter(tag => tag !== tagToRemove));
  };

  const addSuggestedTag = (suggestedTag: string) => {
    addTag(suggestedTag);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(newTag);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-warm-gold" />
        <Label className="text-sm font-medium">AI Generated Tags</Label>
        {isGenerating && (
          <Loader2 className="h-3 w-3 animate-spin text-warm-gold" />
        )}
      </div>

      {/* Current Tags */}
      {tags.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Current Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, index) => (
                <Badge
                  key={index}
                  variant="default"
                  className="flex items-center gap-1 pr-1"
                >
                  {tag}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 rounded-full hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => removeTag(tag)}
                  >
                    <X className="h-2 w-2" />
                  </Button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Suggested Tags */}
      {suggestedTags.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-warm-gold" />
              AI Suggested Tags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {suggestedTags.map((tag, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="cursor-pointer hover:bg-warm-gold/20 hover:border-warm-gold transition-colors"
                  onClick={() => addSuggestedTag(tag)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {tag}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Click on suggested tags to add them, or they'll update as you modify your prompt text.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Manual Tag Input */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Add Custom Tag</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter custom tag..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <Button
              onClick={() => addTag(newTag)}
              disabled={!newTag.trim()}
              variant="outline"
              size="icon"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {promptText.trim().length > 0 && promptText.trim().length < 20 && (
        <p className="text-xs text-muted-foreground">
          Write more in your prompt text (at least 20 characters) to get AI-generated tag suggestions.
        </p>
      )}
    </div>
  );
}