import React from 'react';
import { Platform } from '@/types/platform';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as Icons from 'lucide-react';

export interface PlatformCardProps {
  platform: Platform;
  isSelected?: boolean;
  onSelect: (platform: Platform) => void;
  className?: string;
}

export function PlatformCard({
  platform,
  isSelected = false,
  onSelect,
  className
}: PlatformCardProps) {
  
  // Dynamically get icon component from lucide-react
  const IconComponent = platform.icon && (Icons as any)[platform.icon] 
    ? (Icons as any)[platform.icon] 
    : Icons.FileText;

  // Category color mapping
  const categoryColors = {
    'text-to-text': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'text-to-image': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    'text-to-video': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    'workflow': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    'other': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  };

  const categoryColor = categoryColors[platform.category as keyof typeof categoryColors] 
    || categoryColors.other;

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105",
        "mobile-card mobile-optimize-rendering",
        isSelected && "ring-2 ring-primary shadow-lg",
        className
      )}
      onClick={() => onSelect(platform)}
    >
      <CardHeader className="space-y-3 p-4 sm:p-6">
        <div className="flex items-start justify-between">
          {/* Icon */}
          <div className={cn(
            "p-2 sm:p-3 rounded-lg",
            isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
          )}>
            <IconComponent className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>

          {/* Selected indicator */}
          {isSelected && (
            <div className="bg-primary text-primary-foreground rounded-full p-1 animate-scale-in">
              <Check className="h-3 w-3 sm:h-4 sm:w-4" />
            </div>
          )}
        </div>

        {/* Platform name and category */}
        <div className="space-y-2">
          <CardTitle className="text-base sm:text-lg md:text-xl">{platform.name}</CardTitle>
          <Badge variant="secondary" className={cn(categoryColor, "text-xs")}>
            {platform.category.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </Badge>
        </div>
      </CardHeader>

      {platform.description && (
        <CardContent className="pt-0 p-4 sm:p-6">
          <CardDescription className="text-xs sm:text-sm line-clamp-2">
            {platform.description}
          </CardDescription>
        </CardContent>
      )}
    </Card>
  );
}
