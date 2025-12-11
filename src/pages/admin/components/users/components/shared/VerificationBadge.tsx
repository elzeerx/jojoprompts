import React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface VerificationBadgeProps {
  isVerified: boolean | null | undefined;
  showIcon?: boolean;
  size?: 'sm' | 'default';
  className?: string;
}

export function VerificationBadge({ 
  isVerified, 
  showIcon = true, 
  size = 'default',
  className 
}: VerificationBadgeProps) {
  const config = isVerified === true
    ? {
        label: 'Verified',
        icon: CheckCircle,
        className: 'bg-green-100 text-green-700 border-green-200',
      }
    : isVerified === false
    ? {
        label: 'Unverified',
        icon: XCircle,
        className: 'bg-red-100 text-red-700 border-red-200',
      }
    : {
        label: 'Unknown',
        icon: HelpCircle,
        className: 'bg-gray-100 text-gray-600 border-gray-200',
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
