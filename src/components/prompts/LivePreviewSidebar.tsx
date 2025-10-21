import React from 'react';
import { Platform } from '@/types/platform';
import { BasePromptFields } from '@/types/prompt-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPromptLength } from '@/lib/formatters/promptFormatter';

export interface LivePreviewSidebarProps {
  platform?: Platform;
  baseFields: BasePromptFields;
  platformFields?: Record<string, any>;
  show?: boolean;
  className?: string;
}

export function LivePreviewSidebar({
  platform,
  baseFields,
  platformFields = {},
  show = true,
  className
}: LivePreviewSidebarProps) {
  
  if (!show) return null;

  const stats = baseFields.prompt_text ? getPromptLength(baseFields.prompt_text) : null;
  const hasContent = baseFields.title || baseFields.prompt_text;

  return (
    <Card className={cn("sticky top-4", className)}>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Eye className="h-4 w-4" />
          Live Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Platform Badge */}
        {platform && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Platform</p>
            <Badge variant="secondary">{platform.name}</Badge>
          </div>
        )}

        {/* Title Preview */}
        {baseFields.title ? (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Title</p>
            <p className="text-sm font-medium line-clamp-2">{baseFields.title}</p>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground italic">
            Title not set yet...
          </div>
        )}

        {/* Prompt Preview */}
        {baseFields.prompt_text ? (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Prompt</p>
            <div className="bg-muted rounded p-2 text-xs font-mono max-h-32 overflow-y-auto">
              <pre className="whitespace-pre-wrap break-words line-clamp-6">
                {baseFields.prompt_text}
              </pre>
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground italic">
            Prompt text not set yet...
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Statistics</p>
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline" className="text-xs">
                {stats.characters} chars
              </Badge>
              <Badge variant="outline" className="text-xs">
                {stats.words} words
              </Badge>
              <Badge variant="outline" className="text-xs">
                ~{stats.estimatedTokens} tokens
              </Badge>
            </div>
          </div>
        )}

        {/* Platform Fields Count */}
        {Object.keys(platformFields).length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Configuration</p>
            <p className="text-sm">
              {Object.keys(platformFields).length} {Object.keys(platformFields).length === 1 ? 'setting' : 'settings'} configured
            </p>
          </div>
        )}

        {/* Empty State */}
        {!hasContent && (
          <div className="flex items-start gap-2 p-3 bg-muted rounded">
            <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Start filling the form to see a live preview
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
