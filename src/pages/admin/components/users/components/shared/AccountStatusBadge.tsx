import React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccountStatusBadgeProps {
  isDisabled: boolean;
  showIcon?: boolean;
  size?: 'sm' | 'default';
  className?: string;
}

export function AccountStatusBadge({ 
  isDisabled, 
  showIcon = true, 
  size = 'default',
  className 
}: AccountStatusBadgeProps) {
  const config = isDisabled
    ? {
        label: 'Disabled',
        icon: XCircle,
        className: 'bg-red-100 text-red-700 border-red-200',
      }
    : {
        label: 'Active',
        icon: CheckCircle,
        className: 'bg-green-100 text-green-700 border-green-200',
      };

  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium transition-colors',
        config.className,
        size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1',
        className
      )}
    >
      {showIcon && <Icon className={cn('mr-1', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />}
      {config.label}
    </Badge>
  );
}
