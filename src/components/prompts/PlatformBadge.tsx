import React from 'react';
import { Platform } from '@/types/platform';
import { Badge } from '@/components/ui/badge';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PlatformBadgeProps {
  platform: Platform;
  showIcon?: boolean;
  showCategory?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PlatformBadge({
  platform,
  showIcon = true,
  showCategory = false,
  size = 'md',
  className
}: PlatformBadgeProps) {
  
  const IconComponent = platform.icon && (Icons as any)[platform.icon] 
    ? (Icons as any)[platform.icon] 
    : Icons.FileText;

  const sizeClasses = {
    sm: 'text-xs h-6',
    md: 'text-sm h-7',
    lg: 'text-base h-8'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  return (
    <Badge 
      variant="secondary" 
      className={cn("gap-1.5", sizeClasses[size], className)}
    >
      {showIcon && <IconComponent className={iconSizes[size]} />}
      <span>{platform.name}</span>
      {showCategory && (
        <span className="text-muted-foreground">
          · {platform.category.replace(/-/g, ' ')}
        </span>
      )}
    </Badge>
  );
}
