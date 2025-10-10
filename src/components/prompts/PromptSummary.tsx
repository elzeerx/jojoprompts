import React from 'react';
import { Platform } from '@/types/platform';
import { PromptFormData } from '@/types/prompt-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlatformBadge } from './PlatformBadge';
import { Edit, Image as ImageIcon, Tag } from 'lucide-react';
import { getPromptLength } from '@/lib/formatters/promptFormatter';

export interface PromptSummaryProps {
  data: PromptFormData;
  platform: Platform;
  categoryName?: string;
  onEdit?: (step: number) => void;
  className?: string;
}

export function PromptSummary({
  data,
  platform,
  categoryName,
  onEdit,
  className
}: PromptSummaryProps) {
  const stats = getPromptLength(data.prompt_text);

  return (
    <div className={className}>
      <h3 className="text-lg font-semibold mb-4">Summary</h3>
      
      <div className="space-y-4">
        {/* Platform */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Platform</CardTitle>
              {onEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onEdit(0)}
                  className="h-7"
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <PlatformBadge platform={platform} showCategory size="md" />
          </CardContent>
        </Card>

        {/* Basic Info */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Basic Information</CardTitle>
              {onEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onEdit(1)}
                  className="h-7"
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Title</p>
              <p className="text-sm font-medium">{data.title}</p>
            </div>
            
            {categoryName && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Category</p>
                <Badge variant="secondary">
                  <Tag className="h-3 w-3 mr-1" />
                  {categoryName}
                </Badge>
              </div>
            )}

            {(data.thumbnail || data.thumbnail_url) && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Thumbnail</p>
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Image attached</span>
                </div>
              </div>
            )}

            <div>
              <p className="text-xs text-muted-foreground mb-1">Prompt Length</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{stats.characters} chars</Badge>
                <Badge variant="outline">{stats.words} words</Badge>
                <Badge variant="outline">{stats.lines} lines</Badge>
                <Badge variant="outline">~{stats.estimatedTokens} tokens</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Platform Configuration */}
        {Object.keys(data.platform_fields).length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  {platform.name} Configuration
                </CardTitle>
                {onEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onEdit(2)}
                    className="h-7"
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2">
                {Object.entries(data.platform_fields).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <dt className="text-muted-foreground capitalize">
                      {key.replace(/_/g, ' ')}:
                    </dt>
                    <dd className="font-medium">
                      {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
