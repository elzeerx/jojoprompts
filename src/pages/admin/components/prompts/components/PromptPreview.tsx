import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Eye, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ModelPromptType } from "@/utils/promptTypes";

interface PromptPreviewProps {
  template: ModelPromptType | null;
  formData: Record<string, any>;
  bilingualData: {
    title: { en: string; ar: string };
    promptText: { en: string; ar: string };
  };
  language: 'en' | 'ar';
}

export function PromptPreview({ template, formData, bilingualData, language }: PromptPreviewProps) {
  if (!template) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Eye className="h-5 w-5" />
            Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            Select a template to see preview
          </div>
        </CardContent>
      </Card>
    );
  }

  const generatePromptText = () => {
    let basePrompt = language === 'ar' ? bilingualData.promptText.ar : bilingualData.promptText.en;
    
    if (!basePrompt.trim()) {
      basePrompt = language === 'ar' ? bilingualData.promptText.en : bilingualData.promptText.ar;
    }

    // Add template-specific parameters based on form data
    const parameters = [];
    
    template.fields.forEach(field => {
      const value = formData[field.id];
      if (value && field.id !== 'promptText') {
        if (field.type === 'select' || field.type === 'text') {
          if (field.id === 'parameters' || field.id === 'style_reference') {
            parameters.push(value);
          } else if (field.id.includes('_')) {
            // Format field names with underscores as parameters
            parameters.push(`--${field.id.replace('_', ' ')} ${value}`);
          }
        } else if (field.type === 'multiselect' && Array.isArray(value)) {
          value.forEach(v => parameters.push(`--${field.id} ${v}`));
        }
      }
    });

    // Special handling for different template types
    if (template.category === 'Midjourney') {
      if (formData.aspect_ratio) parameters.push(`--ar ${formData.aspect_ratio}`);
      if (formData.quality) parameters.push(`--q ${formData.quality}`);
      if (formData.style_reference) parameters.push(formData.style_reference);
    }

    return parameters.length > 0 
      ? `${basePrompt} ${parameters.join(' ')}`
      : basePrompt;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied to clipboard",
        description: "Prompt text copied successfully"
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy to clipboard",
        variant: "destructive"
      });
    }
  };

  const finalPrompt = generatePromptText();
  const title = language === 'ar' 
    ? (bilingualData.title.ar || bilingualData.title.en)
    : (bilingualData.title.en || bilingualData.title.ar);

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Eye className="h-5 w-5" />
            Live Preview
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge 
              style={{ backgroundColor: template.color || 'hsl(var(--warm-gold))' }}
              className="text-white text-xs"
            >
              {template.category}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {language === 'ar' ? '🇸🇦 Arabic' : '🇺🇸 English'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Title Preview */}
        {title && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Title:</label>
            <div className="p-3 bg-muted/50 rounded border">
              <p 
                className={`font-medium ${language === 'ar' ? 'text-right' : 'text-left'}`}
                dir={language === 'ar' ? 'rtl' : 'ltr'}
              >
                {title}
              </p>
            </div>
          </div>
        )}

        {/* Prompt Preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-muted-foreground">
              Generated Prompt:
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(finalPrompt)}
              disabled={!finalPrompt.trim()}
              className="text-xs"
            >
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </Button>
          </div>
          <div className="p-4 bg-muted/50 rounded border min-h-[100px] max-h-[200px] overflow-auto">
            {finalPrompt.trim() ? (
              <pre 
                className={`whitespace-pre-wrap text-sm ${language === 'ar' ? 'text-right' : 'text-left'}`}
                dir={language === 'ar' ? 'rtl' : 'ltr'}
              >
                {finalPrompt}
              </pre>
            ) : (
              <div className="flex items-center justify-center h-16 text-muted-foreground text-sm">
                <Sparkles className="h-4 w-4 mr-2" />
                Enter prompt text to see preview
              </div>
            )}
          </div>
        </div>

        {/* Template Parameters */}
        {Object.keys(formData).length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Active Parameters:</label>
            <div className="flex flex-wrap gap-1">
              {Object.entries(formData).map(([key, value]) => {
                if (value && key !== 'promptText' && value !== '') {
                  return (
                    <Badge key={key} variant="secondary" className="text-xs">
                      {key}: {Array.isArray(value) ? value.join(', ') : String(value)}
                    </Badge>
                  );
                }
                return null;
              })}
            </div>
          </div>
        )}

        {/* Character Count */}
        <div className="text-xs text-muted-foreground text-right">
          Character count: {finalPrompt.length}
        </div>
      </CardContent>
    </Card>
  );
}