import React from "react";
import { Badge } from "@/components/ui/badge";
import { Ghost } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface OrphanedBadgeProps {
  hasAuthAccount: boolean;
  showTooltip?: boolean;
  size?: 'sm' | 'default';
  className?: string;
}

export function OrphanedBadge({ 
  hasAuthAccount, 
  showTooltip = true,
  size = 'default',
  className 
}: OrphanedBadgeProps) {
  // Only show badge if orphaned (no auth account)
  if (hasAuthAccount !== false) {
    return null;
  }

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        'font-medium transition-colors bg-amber-100 text-amber-700 border-amber-200',
        size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1',
        showTooltip && 'cursor-help',
        className
      )}
    >
      <Ghost className={cn('mr-1', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      Orphaned
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[250px]">
          <p className="text-sm">
            This profile has no auth account. Password resets, email confirmations, and login will not work.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
