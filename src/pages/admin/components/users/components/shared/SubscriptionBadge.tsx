import React from "react";
import { Badge } from "@/components/ui/badge";
import { Crown, Star, Sparkles, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubscriptionBadgeProps {
  planName: string | null | undefined;
  isLifetime?: boolean;
  status?: string;
  showPrice?: boolean;
  priceUsd?: number;
  size?: 'sm' | 'default';
  className?: string;
}

const planConfig: Record<string, { 
  icon: typeof Crown; 
  className: string;
}> = {
  lifetime: {
    icon: Crown,
    className: 'bg-warm-gold/10 text-warm-gold border-warm-gold/20',
  },
  ultimate: {
    icon: Crown,
    className: 'bg-warm-gold/10 text-warm-gold border-warm-gold/20',
  },
  premium: {
    icon: Star,
    className: 'bg-purple-100 text-purple-700 border-purple-200',
  },
  standard: {
    icon: Sparkles,
    className: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  basic: {
    icon: CreditCard,
    className: 'bg-green-100 text-green-700 border-green-200',
  },
  none: {
    icon: CreditCard,
    className: 'bg-gray-100 text-gray-500 border-gray-200',
  },
};

export function SubscriptionBadge({ 
  planName, 
  isLifetime = false,
  status,
  showPrice = false,
  priceUsd,
  size = 'default',
  className 
}: SubscriptionBadgeProps) {
  const normalizedPlan = planName?.toLowerCase() || 'none';
  const config = isLifetime 
    ? planConfig.lifetime 
    : planConfig[normalizedPlan] || planConfig.none;
  const Icon = config.icon;
  
  const displayName = !planName || planName === 'None' 
    ? 'No Plan' 
    : isLifetime 
    ? `${planName} (Lifetime)` 
    : planName;

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium capitalize transition-colors',
        config.className,
        size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1',
        className
      )}
    >
      <Icon className={cn('mr-1', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      {displayName}
      {showPrice && priceUsd && (
        <span className="ml-1 opacity-75">${priceUsd}</span>
      )}
    </Badge>
  );
}
