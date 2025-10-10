import React, { useMemo, useState } from 'react';
import { Platform } from '@/types/platform';
import { PromptFormData } from '@/types/prompt-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Copy, 
  Check, 
  Edit, 
  FileText, 
  Settings, 
  Image as ImageIcon,
  BarChart3,
  Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPromptForPlatform, getPromptLength } from '@/lib/formatters/promptFormatter';
import { useToast } from '@/hooks/use-toast';

export interface PromptPreviewProps {
  data: PromptFormData;
  platform: Platform;
  categoryName?: string;
  onEdit?: (stepId: string) => void;
  className?: string;
}

export function PromptPreview({
  data,
  platform,
  categoryName,
  onEdit,
  className
}: PromptPreviewProps) {
  const { toast } = useToast();
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  // Format the prompt
  const formatted = useMemo(() => {
    return formatPromptForPlatform(data, platform);
  }, [data, platform]);

  // Get prompt statistics
  const stats = useMemo(() => {
    return getPromptLength(formatted.fullPrompt);
  }, [formatted.fullPrompt]);

  // Copy to clipboard handler
  const handleCopy = async (text: string, section: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(section);
      toast({
        title: "Copied!",
        description: `${section} copied to clipboard`,
      });
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Copy Failed",
        description: "Failed to copy to clipboard",
      });
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Overview Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Prompt Overview
          </CardTitle>
          <CardDescription>
            Review your prompt details before creating
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Title */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground mb-1">Title</p>
              <p className="text-lg font-semibold">{data.title || 'Untitled Prompt'}</p>
            </div>
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit('base-fields')}
                className="flex-shrink-0"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
          </div>

          <Separator />

          {/* Platform & Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground mb-1">Platform</p>
                <div className="flex items-center gap-2">
                  <Badge variant="default">{platform.name}</Badge>
                  <Badge variant="outline">{platform.category}</Badge>
                </div>
              </div>
              {onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit('platform')}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
            </div>

            {categoryName && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Category</p>
                <Badge variant="secondary">{categoryName}</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Formatted Prompt Display */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Formatted Prompt
              </CardTitle>
              <CardDescription>
                Ready-to-use prompt with platform-specific formatting
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(formatted.fullPrompt, 'Full Prompt')}
            >
              {copiedSection === 'Full Prompt' ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm whitespace-pre-wrap break-words max-h-80 overflow-y-auto">
              {formatted.fullPrompt}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Prompt Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{stats.characters}</p>
              <p className="text-xs text-muted-foreground">Characters</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{stats.words}</p>
              <p className="text-xs text-muted-foreground">Words</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{stats.lines}</p>
              <p className="text-xs text-muted-foreground">Lines</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">~{stats.estimatedTokens}</p>
              <p className="text-xs text-muted-foreground">Est. Tokens</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Platform-Specific Configuration */}
      {Object.keys(data.platform_fields).length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Platform Configuration
                </CardTitle>
                <CardDescription>
                  {platform.name}-specific settings
                </CardDescription>
              </div>
              {onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit('platform-fields')}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(data.platform_fields).map(([key, value]) => (
                <div key={key} className="flex items-start justify-between py-2 border-b last:border-0">
                  <div className="flex-1">
                    <p className="text-sm font-medium capitalize">
                      {key.replace(/_/g, ' ')}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Thumbnail Preview */}
      {data.thumbnail_url && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Thumbnail
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <img
                src={data.thumbnail_url}
                alt={data.title}
                className="max-w-full h-auto max-h-64 rounded-lg object-contain"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
